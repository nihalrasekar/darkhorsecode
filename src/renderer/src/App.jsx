import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import CommandPalette from './components/CommandPalette'
import ShortcutsModal from './components/ShortcutsModal'
import { ToastProvider, useToast } from './components/Toast'
import AuthDialog from './components/AuthDialog'
import Home from './pages/Home'
import ProjectGate from './pages/ProjectGate'
import Builder from './pages/Builder'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Deployments from './pages/Deployments'
import Mcp from './pages/Mcp'
import AgentStudio from './pages/AgentStudio'
import Usage from './pages/Usage'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import Architecture from './pages/Architecture'
import useAgentSession from './hooks/useAgentSession'

const pageMeta = {
  home: { title: 'New App', subtitle: 'Describe an idea — agents build it', crumbs: ['build', 'new app'] },
  builder: { title: 'Builder', subtitle: 'Chat with agents · watch it build & preview', crumbs: ['build', 'builder'] },
  architecture: { title: 'Architecture', subtitle: 'The app system tree — logic, not code', crumbs: ['build', 'architecture'] },
  projects: { title: 'Projects', subtitle: 'Your apps, built with AI', crumbs: ['build', 'projects'] },
  'project-detail': { title: 'Project', subtitle: 'Overview, files & settings', crumbs: ['build', 'projects', 'detail'] },
  deployments: { title: 'Deploy', subtitle: 'Ship the project through your connected tools', crumbs: ['build', 'deploy'] },
  studio: { title: 'Agent Studio', subtitle: 'Build and manage your custom agents', crumbs: ['agents', 'studio'] },
  chat: { title: 'Agent Sessions', subtitle: 'Live conversation with your coding agents', crumbs: ['agents', 'sessions'] },
  mcp: { title: 'MCP Connectors', subtitle: 'Model Context Protocol servers & tools', crumbs: ['system', 'mcp'] },
  usage: { title: 'Usage', subtitle: 'Tokens and cost across your agent runs', crumbs: ['system', 'usage'] },
  settings: { title: 'Settings', subtitle: 'Model, API and behaviour preferences', crumbs: ['system', 'settings'] },
  docs: { title: 'Docs', subtitle: 'How to use DarkHorseCode', crumbs: ['system', 'docs'] }
}

const immersivePages = ['builder']
// Settings must stay reachable without a project — that is where you log in.
// Docs is a static help page — same deal, no project needed to read it.
const projectOptionalPages = ['settings', 'docs']

function Shell() {
  const toast = useToast()
  const [route, setRoute] = useState('builder')
  const [activeProject, setActiveProject] = useState(null)
  const [seedPrompt, setSeedPrompt] = useState('')
  const [selectedProjectPath, setSelectedProjectPath] = useState(null)
  // Owned here (not inside Builder) so switching sidebar tabs doesn't wipe out
  // whatever the user was mid-typing in the chat composer.
  const [builderDraft, setBuilderDraft] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Owned here (not inside Builder) so switching sidebar tabs never tears down
  // the live agent run, its transcript, or a pending permission/question prompt.
  const session = useAgentSession()
  // Separate session for the Architecture tab's discussion chat — own transcript,
  // own agent ('architect-chat'), independent of the Builder conversation above.
  const architectSession = useAgentSession({ autoLoad: false })

  const meta = pageMeta[route]
  const immersive = immersivePages.includes(route)
  const gated = !activeProject && !projectOptionalPages.includes(route)

  // "New App" always starts a fresh project — never reuse whatever
  // project happens to be active, or the agent keeps editing the old one.
  const startBuild = async (prompt) => {
    const res = await window.api.project.createFromPrompt(prompt)
    if (res.canceled) return
    if (res.error) return toast(res.error, 'error')
    handleProjectSelected(res.project)
    setSeedPrompt(prompt)
    setRoute('builder')
  }

  const openProject = (path) => {
    setSelectedProjectPath(path)
    setRoute('project-detail')
  }

  const handleProjectSelected = useCallback(
    (project) => {
      setActiveProject(project)
      // A different project has its own sessions — don't keep the last project's transcript/session/draft.
      session.newSession()
      architectSession.newSession()
      setBuilderDraft('')
      window.api.agent?.setDirectory?.(project.path)
      session.refreshDirectory()
      session.refreshSessions()
    },
    [session.newSession, session.refreshDirectory, session.refreshSessions, architectSession.newSession]
  )

  // "type an idea and go": the project is created (and named) from the prompt itself,
  // then the same prompt seeds the builder chat exactly like Home's startBuild.
  const handleStartWithPrompt = useCallback(
    (project, prompt) => {
      handleProjectSelected(project)
      setSeedPrompt(prompt)
      setRoute('builder')
    },
    [handleProjectSelected]
  )

  // Reopen the most recent project that still exists.
  useEffect(() => {
    let cancelled = false
    window.api.project
      .listRecent()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return
        const recent = list.find((p) => p.exists)
        if (recent) handleProjectSelected({ path: recent.path, name: recent.name })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [handleProjectSelected])

  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey
      const inField = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setCollapsed((v) => !v)
      }
      if (e.key === '?' && !inField) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const openChatSession = (sessionId) => {
    session.selectSession(sessionId)
    setRoute('builder')
  }

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar
        route={route}
        onNavigate={setRoute}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        project={activeProject}
        agentState={session.agent}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {!immersive && (
          <TopBar
            {...meta}
            project={activeProject}
            onOpenProjects={() => setRoute('projects')}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}
        <div className="min-h-0 flex-1">
          {gated ? (
            <ProjectGate onProjectSelected={handleProjectSelected} onStartWithPrompt={handleStartWithPrompt} />
          ) : (
            <>
              {route === 'home' && <Home onNavigate={setRoute} onStartBuild={startBuild} project={activeProject} />}
              {route === 'builder' && (
                <Builder
                  key={activeProject?.path}
                  seedPrompt={seedPrompt}
                  onSeedConsumed={() => setSeedPrompt('')}
                  project={activeProject}
                  onNavigate={setRoute}
                  session={session}
                  draft={builderDraft}
                  onDraftChange={setBuilderDraft}
                />
              )}
              {route === 'architecture' && (
                <Architecture onNavigate={setRoute} chat={architectSession} buildSession={session} />
              )}
              {route === 'projects' && (
                <Projects
                  onNavigate={setRoute}
                  onOpenProject={openProject}
                  onProjectSelected={handleProjectSelected}
                  activeProject={activeProject}
                />
              )}
              {route === 'project-detail' && (
                <ProjectDetail
                  projectPath={selectedProjectPath}
                  onNavigate={setRoute}
                  onProjectSelected={handleProjectSelected}
                />
              )}
              {route === 'deployments' && (
                <Deployments project={activeProject} onNavigate={setRoute} session={session} />
              )}
              {route === 'mcp' && <Mcp />}
              {route === 'studio' && <AgentStudio onNavigate={setRoute} />}
              {route === 'usage' && <Usage />}
              {route === 'chat' && <Chat onOpenSession={openChatSession} />}
              {route === 'settings' && <Settings />}
              {route === 'docs' && <Docs />}
            </>
          )}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setRoute} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AuthDialog />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}
