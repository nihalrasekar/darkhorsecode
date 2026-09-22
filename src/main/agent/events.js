const IGNORED = new Set([
  'session.next.agent.switched',
  'session.next.model.switched',
  'session.next.context.updated',
  'session.next.retried',
  'session.next.compaction.started',
  'session.next.compaction.completed',
  'session.updated',
  'session.next.retry_error',
  'plugin.added',
  'server.heartbeat',
  'catalog.updated',
  'reference.updated',
  'integration.updated',
  'session.status',
  'session.diff'
])

// opencode reports a part's role only on `message.updated`, which lands before the
// part events that reference it, so remember it long enough to tag those parts.
const roleByMessage = new Map()

function rememberRole(info) {
  if (!info?.id || !info.role) return
  if (roleByMessage.size > 500) roleByMessage.clear()
  roleByMessage.set(info.id, info.role)
}

// A failed request (bad key, rate limit, network) never produces a text part —
// opencode records the failure on the message itself and the session just goes
// idle, so without this the chat silently shows nothing.
const erroredMessages = new Set()

function messageErrorText(err) {
  if (!err) return null
  const data = err.data || {}
  return String(data.message || err.name || 'The agent request failed.')
}

function partEvent(base, part) {
  if (!part) return null
  // Echoing the user's own parts back would duplicate what the composer already shows.
  if ((roleByMessage.get(part.messageID) || 'assistant') !== 'assistant') return null
  const common = { ...base, messageID: part.messageID, partID: part.id }

  if (part.type === 'text') {
    if (part.synthetic) return null
    return { ...common, kind: 'text_part', text: part.text || '', done: Boolean(part.time?.end) }
  }

  if (part.type === 'tool') {
    const status = part.state?.status
    const tool = { name: part.tool, input: part.state?.input, title: part.state?.title }
    if (status === 'completed') return { ...common, kind: 'tool_end', status: 'success', tool, title: part.state?.title }
    if (status === 'error')
      return { ...common, kind: 'tool_end', status: 'error', tool, error: part.state?.error || 'Tool failed' }
    return { ...common, kind: 'tool_start', tool, callID: part.callID }
  }

  return null
}

export function normalizeEvent(evt) {
  if (!evt || typeof evt !== 'object') return null
  const p = evt.properties || {}
  const base = {
    id: evt.id,
    type: evt.type,
    sessionID: p.sessionID
  }

  switch (evt.type) {
    case 'server.connected':
      return { ...base, kind: 'server_connected' }

    // Current opencode part protocol (1.18.x).
    case 'message.updated': {
      rememberRole(p.info)
      const err = p.info?.error
      const id = p.info?.id
      if (err && id && !erroredMessages.has(id)) {
        erroredMessages.add(id)
        if (erroredMessages.size > 500) erroredMessages.clear()
        return { ...base, kind: 'message_error', messageID: id, message: messageErrorText(err) }
      }
      return null
    }
    case 'message.part.updated':
      return partEvent(base, p.part)
    case 'message.part.delta':
      if (p.field !== 'text') return null
      if ((roleByMessage.get(p.messageID) || 'assistant') !== 'assistant') return null
      return { ...base, kind: 'text_delta', messageID: p.messageID, partID: p.partID, text: p.delta || '' }

    case 'session.next.text.started':
      return { ...base, kind: 'text_start', messageID: p.messageID, partID: p.id }
    case 'session.next.text.delta':
      return { ...base, kind: 'text_delta', messageID: p.messageID, partID: p.id, text: p.delta || '' }
    case 'session.next.text.ended':
      return { ...base, kind: 'text_end', messageID: p.messageID, partID: p.id }

    case 'session.next.tool.called':
      return {
        ...base,
        kind: 'tool_start',
        messageID: p.messageID,
        partID: p.id,
        tool: toolObj(p.tool),
        callID: p.tool?.callID
      }
    case 'session.next.tool.progress':
      return { ...base, kind: 'tool_progress', messageID: p.messageID, partID: p.id, tool: toolObj(p.tool) }
    case 'session.next.tool.success':
      return {
        ...base,
        kind: 'tool_end',
        status: 'success',
        messageID: p.messageID,
        partID: p.id,
        tool: toolObj(p.tool),
        title: p.tool?.title
      }
    case 'session.next.tool.failed':
      return {
        ...base,
        kind: 'tool_end',
        status: 'error',
        messageID: p.messageID,
        partID: p.id,
        tool: toolObj(p.tool),
        error: p.tool?.title || (p.tool && p.tool.error) || 'Tool failed'
      }

    case 'session.next.step.started':
      return { ...base, kind: 'step_start', messageID: p.messageID, partID: p.id, step: p.step || {} }
    case 'session.next.step.ended':
      return {
        ...base,
        kind: 'step_end',
        messageID: p.messageID,
        partID: p.id,
        tokens: p.tokens,
        cost: p.cost,
        files: p.files
      }
    case 'session.next.step.failed':
      return { ...base, kind: 'step_failed', messageID: p.messageID, partID: p.id }

    case 'session.next.shell.started':
      return { ...base, kind: 'shell_start', partID: p.id, cmd: p.cmd }
    case 'session.next.shell.ended':
      return { ...base, kind: 'shell_end', partID: p.id, cmd: p.cmd }

    case 'session.next.prompted':
      return { ...base, kind: 'user_message', messageID: p.messageID }

    case 'permission.asked':
      return {
        ...base,
        kind: 'permission',
        sessionID: p.sessionID,
        permissionID: p.id || p.permissionID,
        permission: {
          tool: p.permission,
          patterns: p.patterns || [],
          metadata: p.metadata || {},
          always: p.always || []
        },
        description: p.metadata?.description || (p.patterns || []).join(', '),
        directory: p.directory
      }
    case 'permission.replied':
      return { ...base, kind: 'permission_replied', permissionID: p.requestID, reply: p.reply }

    case 'question.v2.asked':
      return {
        ...base,
        kind: 'question',
        sessionID: p.sessionID,
        questionID: p.question?.id || p.id,
        question: p.question
      }
    case 'question.v2.replied':
      return { ...base, kind: 'question_closed', questionID: p.question?.id || p.id }
    case 'question.v2.rejected':
      return { ...base, kind: 'question_closed', questionID: p.question?.id || p.id }

    case 'session.next.shouldStop':
      return { ...base, kind: 'should_stop' }
    case 'session.idle':
      return { ...base, kind: 'session_idle' }

    default:
      if (IGNORED.has(evt.type)) return null
      return { ...base, kind: 'other' }
  }
}

function toolObj(tool) {
  if (typeof tool === 'string') return { name: tool }
  return tool || {}
}

export function permissionSummary(permission) {
  if (!permission) return { tool: 'tool', detail: '' }
  const tool = permission.tool || 'tool'
  let detail = ''
  const input = permission.input || {}
  if (tool === 'bash') detail = String(input.command || '')
  else if (tool === 'edit') detail = String(input.filePath || input.file_path || '')
  else if (tool === 'webfetch') detail = String(input.url || '')
  else if (typeof permission.code === 'string' && permission.code) detail = permission.code
  else if (permission.description) detail = permission.description
  else detail = (input.description || input.title || '').toString()
  return { tool, detail }
}

export function questionSummary(question) {
  if (!question) return { prompt: 'Question from the agent', canSkip: true }
  const prompt =
    question.prompt || question.question || (question.title ? `${question.title}` : 'Question from the agent')
  return {
    prompt,
    canSkip: question.canSkip ?? true
  }
}

export function normalizeMessages(entries) {
  const items = []
  for (const { info, parts } of entries) {
    const role = info.role
    if (info.error) {
      items.push({ kind: 'error', id: `err-${info.id}`, role: 'assistant', text: messageErrorText(info.error) })
    }
    for (const part of parts) {
      if (!part) continue
      if (part.type === 'text') {
        if (part.synthetic) continue
        items.push({
          kind: 'text',
          id: part.id,
          messageID: part.messageID,
          sessionID: part.sessionID,
          role,
          text: part.text,
          time: part.time
        })
      } else if (part.type === 'tool') {
        items.push({
          kind: 'tool',
          id: part.id,
          messageID: part.messageID,
          sessionID: part.sessionID,
          role,
          tool: part.tool,
          callID: part.callID,
          state: part.state || { status: 'running' }
        })
      } else if (part.type === 'file') {
        items.push({ kind: 'file', id: part.id, role, url: part.url, mime: part.mime, time: part.time })
      } else if (part.type === 'shell') {
        items.push({ kind: 'shell', id: part.id, role, state: part.state, input: part.state?.input })
      } else if (part.type === 'step') {
        items.push({ kind: 'step', id: part.id, role, input: part.input, state: part.state })
      }
    }
  }
  return items
}