/**
 * Pure reducer over the normalized agent SSE stream (see src/main/agent/events.js).
 * No React, no window — so it can be unit tested with `node --test`.
 *
 * items: [{ kind:'text', id, role, text, streaming }
 *        | { kind:'tool', id, role, toolName, title, state:'running'|'success'|'error' }]
 * The `id` is the opencode partID, which is what every follow-up event keys on.
 */

export function toolTitle(part) {
  const tool = part?.tool || {}
  const input = tool.input || {}
  const name = String(tool.name || tool.tool || part?.toolName || 'tool')
  if (name === 'bash' || name === 'shell') return String(input.command || name)
  if (name === 'edit' || name === 'apply_patch') return String(input.filePath || input.file_path || name)
  if (name === 'webfetch' || name === 'fetch') return String(input.url || name)
  if (name === 'grep') return String(input.pattern ? `${input.pattern}${input.path ? ` in ${input.path}` : ''}` : name)
  if (name === 'glob' || name === 'list') return String(input.pattern || input.path || name)
  if (name === 'read') return String(input.filePath || input.file_path || name)
  if (name === 'task') return String(input.description || input.prompt || name)
  if (typeof input === 'string') return input
  if (input.title) return String(input.title)
  if (input.description) return String(input.description)
  return name
}

const replaceAt = (items, idx, patch) => {
  const next = items.slice()
  next[idx] = { ...next[idx], ...patch }
  return next
}

export function applyAgentEvent(items, evt) {
  if (!evt || !evt.kind) return items
  const idx = evt.partID ? items.findIndex((i) => i.id === evt.partID) : -1

  switch (evt.kind) {
    case 'text_start':
      if (idx !== -1) return items
      return [...items, { kind: 'text', id: evt.partID, role: 'assistant', text: '', streaming: true }]

    // A whole text part; opencode re-sends it as it grows, so replace rather than append.
    case 'text_part':
      if (idx === -1)
        return [...items, { kind: 'text', id: evt.partID, role: 'assistant', text: evt.text || '', streaming: !evt.done }]
      return replaceAt(items, idx, { text: evt.text ?? items[idx].text, streaming: !evt.done })

    case 'text_delta':
      if (idx === -1) return items
      return replaceAt(items, idx, { text: items[idx].text + (evt.text || '') })

    case 'text_end':
      if (idx === -1) return items
      return replaceAt(items, idx, { streaming: false })

    case 'tool_start':
      if (idx !== -1) return items
      return [
        ...items,
        {
          kind: 'tool',
          id: evt.partID,
          role: 'assistant',
          toolName: evt.tool?.name || evt.tool?.tool || 'tool',
          title: toolTitle({ tool: evt.tool }),
          input: evt.tool?.input || {},
          state: 'running'
        }
      ]

    case 'tool_end':
      if (idx === -1) return items
      return replaceAt(items, idx, {
        state: evt.status,
        input: evt.tool?.input || items[idx].input,
        title: evt.status === 'error' ? evt.error || items[idx].title : items[idx].title
      })

    case 'shell_start':
      if (idx !== -1) return items
      return [
        ...items,
        { kind: 'tool', id: evt.partID, role: 'assistant', toolName: 'shell', title: evt.cmd, state: 'running' }
      ]

    case 'shell_end':
      if (idx === -1) return items
      return replaceAt(items, idx, { state: 'success' })

    // A request that failed outright (bad key, rate limit, network) never produced a
    // text part to update — show the failure itself as a bubble.
    case 'message_error':
      return [...items, { kind: 'error', id: `err-${evt.messageID}`, role: 'assistant', text: evt.message }]

    default:
      return items
  }
}

/**
 * History from `agent.getMessages` comes back in the on-disk part shape, which does not
 * match the live-event shape above. Flatten it so one renderer handles both.
 */
export function normalizeHistoryItems(items) {
  const out = []
  for (const item of items || []) {
    if (item.kind === 'text') {
      out.push({ kind: 'text', id: item.id, role: item.role, text: item.text || '', streaming: false })
    } else if (item.kind === 'tool') {
      const tool = typeof item.tool === 'string' ? { name: item.tool } : item.tool || {}
      const input = tool.input || item.state?.input || {}
      out.push({
        kind: 'tool',
        id: item.id,
        role: item.role,
        toolName: tool.name || tool.tool || 'tool',
        title: toolTitle({ tool: { ...tool, input } }),
        input,
        state: item.state?.status === 'error' ? 'error' : 'success'
      })
    } else if (item.kind === 'shell') {
      out.push({
        kind: 'tool',
        id: item.id,
        role: item.role,
        toolName: 'shell',
        title: String(item.input?.command || item.state?.input?.command || 'shell'),
        state: 'success'
      })
    }
    // 'file' and 'step' parts carry nothing worth rendering in the transcript
  }
  return out
}

/** Running token/cost total, fed by step_end events. */
export function applyUsage(usage, evt) {
  if (!evt || evt.kind !== 'step_end') return usage
  const t = evt.tokens || {}
  const cache = t.cache || {}
  const tokens =
    (Number(t.input) || 0) +
    (Number(t.output) || 0) +
    (Number(t.reasoning) || 0) +
    (Number(cache.read) || 0) +
    (Number(cache.write) || 0)
  if (!tokens && !evt.cost) return usage
  return { tokens: usage.tokens + tokens, cost: usage.cost + (Number(evt.cost) || 0) }
}
