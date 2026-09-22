import { useCallback, useEffect, useRef, useState } from 'react'
import { applyAgentEvent, applyUsage, normalizeHistoryItems } from './applyAgentEvent.mjs'

/**
 * One live opencode session: transcript, streaming, permission/question prompts.
 * Shared by Chat and Builder — the only place that talks to window.api.agent for chat.
 */
export default function useAgentSession({ autoLoad = true } = {}) {
  const [agent, setAgent] = useState({
    running: false,
    ready: false,
    hasApiKey: false,
    hasCredentials: false
  })
  const [directory, setDirectory] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [permission, setPermission] = useState(null)
  const [question, setQuestion] = useState(null)
  const [usage, setUsage] = useState({ tokens: 0, cost: 0 })
  const [error, setError] = useState(null)
  // Prompt typed before any provider was signed in — held, then sent after login.
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const activeIdRef = useRef(null)
  const agentRef = useRef(agent)
  const readyWaitersRef = useRef([])
  // send() seeds items itself when it creates a session, so the activeId effect
  // below must not clobber that with an (empty) history fetch for it.
  const skipNextLoadRef = useRef(false)

  activeIdRef.current = activeId
  agentRef.current = agent

  const refreshSessions = useCallback(async () => {
    try {
      const list = await window.api.agent.listSessions(undefined)
      const sorted = (list || []).sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0))
      setSessions(sorted)
      return sorted
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadMessages = useCallback(async (sessionID) => {
    setItems([])
    try {
      const msgs = await window.api.agent.getMessages(sessionID, undefined, 300)
      setItems(normalizeHistoryItems(msgs))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api.agent
      .status()
      .then((s) => !cancelled && setAgent(s))
      .then(() => window.api.agent.getDirectory())
      .then((dir) => !cancelled && setDirectory(dir))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // The session now lives above Builder/Chat and outlives a project switch, so
  // callers must explicitly point it at the newly-selected project's directory.
  const refreshDirectory = useCallback(async () => {
    try {
      setDirectory(await window.api.agent.getDirectory())
    } catch {}
  }, [])

  useEffect(() => {
    const offEvent = window.api.agent.onEvent((evt) => {
      // The stream is per-directory, not per-session: drop anything for another session.
      // No active session means no session's events should pass, not "accept everything".
      if (evt.sessionID && evt.sessionID !== activeIdRef.current) return

      if (evt.kind === 'permission') setPermission(evt)
      else if (evt.kind === 'question') setQuestion(evt)
      else if (evt.kind === 'session_idle' || evt.kind === 'should_stop') {
        setBusy(false)
        refreshSessions()
      } else if (evt.kind === 'message_error') {
        setBusy(false)
        setError(evt.message)
      } else if (evt.kind === 'step_end') {
        setUsage((u) => applyUsage(u, evt))
      }

      setItems((prev) => applyAgentEvent(prev, evt))
    })

    const offState = window.api.agent.onState((s) => {
      setAgent((prev) => ({ ...prev, running: s.state !== 'stopped', ready: s.state === 'ready' }))
      if (s.state === 'ready') {
        const waiters = readyWaitersRef.current
        readyWaitersRef.current = []
        for (const resolve of waiters) resolve(true)
      }
    })

    return () => {
      offEvent()
      offState()
    }
  }, [refreshSessions])

  /** Resolve once the runtime reports ready (it restarts after a sign-in). */
  const waitForReady = useCallback((timeout = 45000) => {
    if (agentRef.current.ready) return Promise.resolve(true)
    return new Promise((resolve) => {
      readyWaitersRef.current.push(resolve)
      setTimeout(() => {
        readyWaitersRef.current = readyWaitersRef.current.filter((r) => r !== resolve)
        resolve(false)
      }, timeout)
    })
  }, [])

  useEffect(() => {
    if (autoLoad) refreshSessions()
  }, [autoLoad, refreshSessions])

  useEffect(() => {
    if (!activeId) return
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false
      return
    }
    loadMessages(activeId)
  }, [activeId, loadMessages])

  const send = useCallback(
    async (text, { title, agent: agentName, model } = {}) => {
      const body = (text || '').trim()
      if (!body || busy) return null

      // No provider signed in yet — hold the prompt and let SignInGate take over.
      if (!agentRef.current.hasCredentials) {
        setPendingPrompt({ text: body, title, agent: agentName })
        return null
      }

      setError(null)
      let sessionID = activeIdRef.current
      try {
        if (!sessionID) {
          const session = await window.api.agent.createSession(title || body.slice(0, 44), undefined)
          sessionID = session?.id
          setSessions((prev) => [{ ...session }, ...prev])
          skipNextLoadRef.current = true
          setActiveId(sessionID)
          activeIdRef.current = sessionID
          setItems([])
        }
        setItems((prev) => [
          ...prev,
          { kind: 'text', id: `u-${Date.now()}`, role: 'user', text: body, streaming: false }
        ])
        setBusy(true)
        await window.api.agent.send(sessionID, body, undefined, agentName, model)
        return sessionID
      } catch (err) {
        setError(err.message)
        setBusy(false)
        return null
      }
    },
    [busy]
  )

  const stop = useCallback(async () => {
    const id = activeIdRef.current
    if (!id) return
    setBusy(false)
    try {
      await window.api.agent.abort(id, undefined)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const selectSession = useCallback((id) => {
    setActiveId((prev) => (prev === id ? prev : id))
  }, [])

  const newSession = useCallback(() => {
    const staleId = activeIdRef.current
    if (staleId) window.api.agent.abort(staleId, undefined).catch(() => {})
    setActiveId(null)
    setItems([])
    setUsage({ tokens: 0, cost: 0 })
    setBusy(false)
    setError(null)
    setPermission(null)
    setQuestion(null)
  }, [])

  const replyPermission = useCallback((reply) => {
    setPermission((p) => {
      if (p) window.api.agent.replyPermission(p.permissionID, reply, undefined).catch(() => {})
      return null
    })
  }, [])

  const replyQuestion = useCallback((answer) => {
    setQuestion((q) => {
      if (q) window.api.agent.replyQuestion(q.questionID, answer, undefined).catch(() => {})
      return null
    })
  }, [])

  const skipQuestion = useCallback(() => {
    setQuestion((q) => {
      if (q) window.api.agent.rejectQuestion(q.questionID, undefined).catch(() => {})
      return null
    })
  }, [])

  const cancelPendingPrompt = useCallback(() => setPendingPrompt(null), [])

  // After a successful sign-in the runtime restarts; once it is back, send what was held.
  useEffect(() => {
    return window.api.auth.onDone(async ({ ok }) => {
      const status = await window.api.agent.status().catch(() => null)
      if (status) {
        setAgent(status)
        agentRef.current = status
      }
      if (!ok || !status?.hasCredentials) return

      const held = pendingPrompt
      if (!held) return
      setPendingPrompt(null)

      const becameReady = await waitForReady()
      if (!becameReady) {
        setError('Signed in, but the agent did not come back up. Try sending again.')
        return
      }
      send(held.text, { title: held.title, agent: held.agent })
    })
  }, [pendingPrompt, send, waitForReady])

  return {
    agent,
    directory,
    projectName: directory ? directory.split(/[\\/]/).pop() : null,
    sessions,
    activeId,
    items,
    busy,
    loadingSessions,
    permission,
    question,
    usage,
    error,
    setError,
    pendingPrompt,
    authRequired: Boolean(pendingPrompt),
    cancelPendingPrompt,
    send,
    stop,
    selectSession,
    newSession,
    refreshSessions,
    refreshDirectory,
    replyPermission,
    replyQuestion,
    skipQuestion
  }
}
