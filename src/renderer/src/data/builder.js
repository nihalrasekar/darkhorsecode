// Static seed content for the UI: suggestion prompts, build-type labels, and the
// demo-preview pick map. Everything else in this app now comes from the agent runtime.
export const trendingPrompts = [
  'A fitness tracking app with workout logs and progress charts',
  'SaaS dashboard with revenue analytics and customer table',
  'A marketplace for renting camera gear',
  'Landing page for a coffee subscription startup',
  'An invoice generator with PDF export',
  'A habit tracker with streaks and reminders'
]

export const buildTypes = [
  { id: 'fullstack', label: 'Full-stack app', desc: 'React + API + database' },
  { id: 'landing', label: 'Landing page', desc: 'Marketing site' },
  { id: 'website', label: 'Website', desc: 'Multi-page site' }
]

export const agentTools = [
  { id: 'read', label: 'Read files', desc: 'Open & inspect any project file' },
  { id: 'write', label: 'Write files', desc: 'Create & edit source code' },
  { id: 'shell', label: 'Run shell commands', desc: 'npm, git, tests, scripts' },
  { id: 'browser', label: 'Browser & screenshots', desc: 'Interact with the preview, capture screenshots' },
  { id: 'db', label: 'Database access', desc: 'Query Postgres / MongoDB' },
  { id: 'image', label: 'Generate images', desc: 'Create UI assets & icons' },
  { id: 'api', label: 'Call external APIs', desc: 'HTTP requests with auth' },
  { id: 'deploy', label: 'Deploy', desc: 'Push previews & production' }
]

export const customAgents = [
  {
    id: 'ag-1',
    name: 'Architect',
    persona: 'A senior systems architect who designs clean, scalable application structure before any code is written.',
    systemPrompt: 'You plan the overall architecture. Always produce a component breakdown, data model and API surface before delegating implementation to sub-agents.',
    model: 'claude-opus-4',
    tools: ['read', 'write', 'shell'],
    subAgents: ['Developer', 'Designer'],
    status: 'active',
    icon: 'arch'
  },
  {
    id: 'ag-2',
    name: 'Developer',
    persona: 'A pragmatic full-stack engineer that implements features quickly while keeping the codebase maintainable.',
    systemPrompt: 'You implement features from the Architect\'s plan. Write TypeScript, add tests, run them, and fix failures before handing back.',
    model: 'claude-sonnet-4',
    tools: ['read', 'write', 'shell', 'db', 'api'],
    subAgents: [],
    status: 'active',
    icon: 'dev'
  },
  {
    id: 'ag-3',
    name: 'Designer',
    persona: 'A product designer obsessed with polished, consistent UI � spacing, color and typography.',
    systemPrompt: 'You own visual quality. Ensure every screen follows the design system. Use the browser to screenshot and verify layouts.',
    model: 'claude-sonnet-4',
    tools: ['read', 'write', 'browser', 'image'],
    subAgents: [],
    status: 'active',
    icon: 'design'
  },
  {
    id: 'ag-4',
    name: 'Code Reviewer',
    persona: 'A strict reviewer that finds bugs, security holes and performance traps before deployment.',
    systemPrompt: 'You review every diff. Flag critical issues first, then style. Always approve or request changes explicitly.',
    model: 'claude-haiku-4',
    tools: ['read', 'shell', 'db'],
    subAgents: [],
    status: 'draft',
    icon: 'review'
  },
  {
    id: 'ag-5',
    name: 'Content Writer',
    persona: 'A marketing copywriter that keeps a consistent brand voice across pages and notifications.',
    systemPrompt: 'You write user-facing copy. Maintain the brand voice, adapt tone per platform, include CTAs where relevant.',
    model: 'claude-haiku-4',
    tools: ['read', 'write', 'image'],
    subAgents: [],
    status: 'active',
    icon: 'writer'
  }
]
