/**

 * -------------------------------------------
 * Run this inside any page via playwriter to get a "touch-to-pick"
 * flow: an arrow follows the mouse, hovered elements highlight, and
 * clicking a (left or right) element captures its metadata, filters it
 * down to stable selectors + relevant attributes, and makes it ready to
 * hand to an LLM.
 *
 * Usage via playwriter CLI:
 *   playwriter -s 1 -e "$(cat <<'EOF'
 *   state.page = context.pages().find((p) => p.url().includes('your-app')) ?? (await context.newPage())
 *   await state.page.evaluate(() => { (globalThis.__energentPick = (window => {
 *     // paste the picker source below (or read it from this file)
 *   })()) })
 *   EOF
 *   )"
 *
 * Then in the page: move the mouse to aim the arrow, press `Alt` to arm
 * picking, click the element. The result lands in:
 *   window.__energentPicked            // filtered fingerprint (JSON)
 *   window.__energentPickedRaw        // full unfiltered metadata
 * and is also printed to the console as `__ENERGENT_PICK__ <json>`.
 *
 * Keyboard:
 *   Alt          arm/disarm picking (highlight appears while armed)
 *   Esc          cancel pick, remove overlay
 */
;(() => {
  if (window.__energentPickerInstalled) return
  window.__energentPickerInstalled = true

  /* ---------- attribute allow-lists (the "filter") ---------- */
  const KEEP_ATTRS = [
    'data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-e2e',
    'data-component', 'data-role', 'data-name', 'data-key', 'data-index',
    'name', 'type', 'placeholder', 'href', 'src', 'alt', 'title', 'aria-label',
    'aria-labelledby', 'aria-describedby', 'role', 'value', 'for', 'action',
    'method', 'disabled', 'required', 'maxlength', 'minlength'
  ]
  const KEEP_STYLES = [
    'display', 'position', 'color', 'backgroundColor', 'fontSize',
    'fontWeight', 'lineHeight', 'padding', 'margin', 'border', 'borderRadius',
    'width', 'height', 'maxWidth', 'boxShadow', 'cursor', 'gap'
  ]

  /* ---------- overlay DOM ---------- */
  const root = document.createElement('div')
  root.setAttribute('data-energent-picker', 'overlay')
  root.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
    'font-family:ui-monospace,Menlo,Consolas,monospace;'

  const arrow = document.createElement('div')
  arrow.style.cssText =
    'position:fixed;top:0;left:0;width:26px;height:26px;display:none;' +
    'transform:translate(-4px,-6px);will-change:transform;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));'

  const highlight = document.createElement('div')
  highlight.style.cssText =
    'position:fixed;top:0;left:0;box-sizing:border-box;' +
    'border:1.5px solid #34d399;background:rgba(52,211,153,.10);' +
    'border-radius:2px;display:none;will-change:top,left,width,height;'

  const tooltip = document.createElement('div')
  tooltip.style.cssText =
    'position:fixed;top:0;left:0;max-width:320px;padding:5px 8px;' +
    'background:#0f0f14;color:#e7e7ea;border:1px solid #34d399;border-radius:6px;' +
    'font-size:11px;line-height:1.5;display:none;will-change:top,left;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.5);'

  arrow.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none">' +
    '<path d="M4 2l7 19 2.2-6.8L20 12 4 2z" fill="#34d399" stroke="#0f0f14" stroke-width="1.2"/>' +
    '</svg>'

  root.append(arrow, highlight, tooltip)
  ;(document.documentElement || document.body).appendChild(root)

  /* ---------- state ---------- */
  let armed = false
  let hoverEl = null
  let rect = null

  const css = (el, k) => {
    try { return window.getComputedStyle(el)[k] } catch { return undefined }
  }

  const truncated = (s, n) => {
    if (typeof s !== 'string') return s
    const t = s.replace(/\s+/g, ' ').trim()
    return t.length > n ? t.slice(0, n) + '…' : t
  }

  const stableAttr = (el, keys) => {
    for (const k of keys) {
      const v = el.getAttribute(k)
      if (v) return { key: k, value: v }
    }
    return null
  }

  /* ---------- React fiber → exact source location (what emergent does) ---------- */
  // Walk the element's React fiber chain up to the nearest component that was
  // authored in source. In dev builds React attaches `_debugSource`
  // { fileName, lineNumber, columnNumber } to host/component fibers, resolved
  // from source maps — the same trick emergent / react-dev-inspector use to
  // jump from a clicked DOM node straight to the file + line.
  const getFiber = (el) => {
    for (const key in el) {
      if (
        key.startsWith('__reactFiber$') || // React 16+
        key.startsWith('__reactInternalInstance$') // legacy React 15
      ) {
        return el[key]
      }
    }
    return null
  }

  const getReactSource = (el) => {
    const fiber = getFiber(el)
    if (!fiber) return null
    let cursor = fiber
    let depth = 0
    while (cursor && depth < 40) {
      const type = cursor.type
      const name =
        (type && (type.displayName || type.name)) ||
        (typeof cursor.elementType === 'string' ? cursor.elementType : null)
      const src = cursor._debugSource
      if (src && src.fileName && name && name !== 'div') {
        return {
          component: name,
          file: String(src.fileName).replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'),
          line: src.lineNumber,
          column: src.columnNumber,
          key: cursor.key ? String(cursor.key) : undefined,
          props: Object.keys(cursor.memoizedProps || {})
            .filter((k) => /^(data-|aria-|id|className|type|name|placeholder|href|title|alt)$/.test(k))
            .slice(0, 8)
        }
      }
      cursor = cursor.return
      depth++
    }
    // fall back to the nearest named component even without source map
    cursor = fiber
    while (cursor) {
      const type = cursor.type
      const name = type && (type.displayName || type.name)
      if (name && name !== 'div') {
        return { component: name, file: null, line: null, column: null }
      }
      cursor = cursor.return
    }
    return null
  }

  /* ---------- metadata extraction (full, unfiltered) ---------- */
  const extract = (el) => {
    const attrs = {}
    for (const a of Array.from(el.attributes || [])) {
      if (/^data-|^aria-/.test(a.name) || KEEP_ATTRS.includes(a.name)) {
        attrs[a.name] = truncated(a.value, 160)
      }
    }
    const id = el.id
    const dataTest = stableAttr(el, ['data-testid', 'data-test', 'data-cy', 'data-test-id'])
    const role = el.getAttribute('role') || el.getAttribute('aria-role')
    const name = el.getAttribute('name')
    const ariaLabel = el.getAttribute('aria-label')
    const href = el.getAttribute('href')

    const hierarchy = []
    let n = el.parentElement
    while (n && hierarchy.length < 5) {
      const tag = n.tagName.toLowerCase()
      const d = n.getAttribute('data-testid') || n.getAttribute('data-test')
      hierarchy.push({
        tag,
        id: n.id || undefined,
        dataTestid: d || undefined,
        ariaLabel: n.getAttribute('aria-label') || undefined,
        text: truncated(n.innerText || n.textContent, 40)
      })
      n = n.parentElement
    }

    // CSS path + XPath
    const cssPath = []
    let cur = el
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      const tag = cur.tagName.toLowerCase()
      const parent = cur.parentElement
      if (parent) {
        const sibs = Array.from(parent.children).filter((s) => s.tagName === cur.tagName)
        cssPath.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(cur) + 1})` : tag)
      } else {
        cssPath.unshift(tag)
      }
      cur = parent
    }

    const styles = {}
    for (const k of KEEP_STYLES) {
      const v = css(el, k)
      if (v && v !== 'none' && v !== 'auto') styles[k] = v
    }

    const text = truncated(el.innerText || el.textContent, 200)
    const fullText = truncated(el.textContent, 500)

    const rectObj = el.getBoundingClientRect()

    return {
      pickedAt: new Date().toISOString(),
      url: location.href,
      element: {
        tag: el.tagName.toLowerCase(),
        id: id || undefined,
        class: el.className && typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 12) : undefined,
        attributes: Object.keys(attrs).length ? attrs : undefined,
        stable: {
          dataTestid: dataTest?.value,
          ariaLabel,
          role,
          name,
          href
        },
        text,
        fullText,
        hierarchy,
        cssPath: cssPath.join(' > '),
        xpath:
          document.evaluate &&
          (() => {
            const out = []
            let c = el
            while (c && c.nodeType === 1) {
              let idx = 1
              let sib = c.previousElementSibling
              while (sib) { if (sib.tagName === c.tagName) idx++; sib = sib.previousElementSibling }
              out.unshift(`${c.tagName.toLowerCase()}[${idx}]`)
              c = c.parentElement
            }
            return out.join('/')
          })(),
        styles,
        rect: {
          x: Math.round(rectObj.x), y: Math.round(rectObj.y),
          width: Math.round(rectObj.width), height: Math.round(rectObj.height)
        },
        visible: !!(css(el, 'display') !== 'none' && css(el, 'visibility') !== 'hidden' && rectObj.width > 0),
        disabled: el.disabled === true,
        codeLocation: getReactSource(el)
      }
    }
  }

  /* ---------- the filter: reduce metadata to LLM-grade fingerprint ---------- */
  const filterForLLM = (meta) => {
    const e = meta.element
    const s = e.stable
    const selectors = []
    const add = (desc, sel) => { if (sel) selectors.push({ kind: desc, selector: sel }) }

    add('data-testid', s.dataTestid && `[data-testid="${s.dataTestid}"]`)
    add('id', e.id && `#${e.id}`)
    add('aria-label', s.ariaLabel && e.tag && `[aria-label="${s.ariaLabel}"]`)
    add('role+name', s.role && e.text && `${e.tag}[role="${s.role}"]:has-text("${truncated(e.text, 24)}")`)
    add('name', s.name && `${e.tag}[name="${s.name}"]`)
    add('href', s.href && `a[href="${s.href}"]`)
    add('css-path', e.cssPath)
    add('xpath', e.xpath)

    return {
      kind: 'element-fingerprint',
      url: meta.url,
      element: {
        tag: e.tag,
        label: [s.role, s.ariaLabel, e.text].filter(Boolean).slice(0, 2).join(' · ') || e.tag,
        text: e.text,
        attributes: e.attributes,
        styles: e.styles,
        rect: e.rect
      },
      selectors,
      bestSelector: selectors[0]?.selector || null,
      code: e.codeLocation,
      context: {
        parent: e.hierarchy?.[0],
        pageSection: e.hierarchy?.map((h) => h.tag).join(' > ')
      }
    }
  }

  /* ---------- events ---------- */
  const updateCursor = (x, y) => {
    arrow.style.transform = `translate(${x - 4}px,${y - 6}px)`
  }

  const showTooltip = (el) => {
    const t = []
    const tag = el.tagName.toLowerCase()
    t.push(tag)
    if (el.getAttribute('data-testid')) t.push(`[data-testid="${el.getAttribute('data-testid')}"]`)
    if (el.id) t.push(`#${el.id}`)
    if (el.getAttribute('aria-label')) t.push(`[aria-label="${el.getAttribute('aria-label')}"]`)
    const txt = truncated(el.innerText || el.textContent, 40)
    if (txt) t.push(`"${txt}"`)
    tooltip.textContent = t.join(' ')
    const r = el.getBoundingClientRect()
    const pad = 12
    let top = r.top - tooltip.offsetHeight - 8
    let left = Math.min(r.left, window.innerWidth - tooltip.offsetWidth - 8)
    if (top < 0) top = r.bottom + 8
    tooltip.style.top = `${Math.max(0, top)}px`
    tooltip.style.left = `${Math.max(0, left)}px`
    tooltip.style.display = 'block'
  }

  const highlightEl = (el) => {
    if (!armed || !el) {
      highlight.style.display = 'none'
      tooltip.style.display = 'none'
      return
    }
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) {
      highlight.style.display = 'none'
      tooltip.style.display = 'none'
      return
    }
    highlight.style.top = `${r.top}px`
    highlight.style.left = `${r.left}px`
    highlight.style.width = `${r.width}px`
    highlight.style.height = `${r.height}px`
    highlight.style.display = 'block'
    showTooltip(el)
  }

  const pick = (el, ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    const raw = extract(el)
    const filtered = filterForLLM(raw)
    window.__energentPicked = filtered
    window.__energentPickedRaw = raw
    window.__energentPickDone = true
    const evt = new CustomEvent('energent:picked', { detail: filtered })
    document.dispatchEvent(evt)
    console.log('__ENERGENT_PICK__', JSON.stringify(filtered))
    disarm()
  }

  const onClick = (ev) => {
    if (!armed) return
    const el = ev.target
    if (el && el.closest('[data-energent-picker]')) return
    if (el && el !== document.documentElement && el !== document.body) {
      pick(el, ev)
    }
  }

  const onMove = (ev) => {
    const { clientX: x, clientY: y } = ev
    updateCursor(x, y)
    const el = document.elementFromPoint(x, y)
    if (el && el.closest('[data-energent-picker]')) {
      hoverEl = null
      highlightEl(null)
      return
    }
    if (el !== hoverEl) {
      hoverEl = el
      highlightEl(el)
    }
  }

  const onKey = (ev) => {
    if (ev.key === 'Alt') {
      ev.preventDefault()
      setArmed(!armed)
    }
    if (ev.key === 'Escape') {
      disarm()
      remove()
    }
  }

  const setArmed = (v) => {
    armed = v
    highlightEl(hoverEl)
    arrow.style.display = v ? 'block' : 'none'
    // `root` is pointer-events:none so its own cursor style never paints — hide the
    // real page cursor directly, or the native pointer and the green arrow both show.
    document.documentElement.style.cursor = v ? 'none' : ''
    root.dataset.armed = v ? '1' : '0'
  }

  const disarm = () => setArmed(false)

  const remove = () => {
    disarm()
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKey, true)
    root.remove()
    delete window.__energentPickerInstalled
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKey, true)

  window.__energentPicker = { arm: () => setArmed(true), disarm, remove, extract, filterForLLM }
  window.__energentPickerInstalled = true
  console.log('[energent-picker] ready — move to aim the arrow, press Alt to arm, click to pick, Esc to exit')
})()
