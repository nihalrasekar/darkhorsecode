/**
 * Turn a UI custom agent into an opencode config agent entry.
 * Pure — shared by the main-process config builder and covered by node --test.
 */

// Built-in agent names opencode already owns; a custom agent must never shadow one.
export const RESERVED_AGENTS = new Set(['architect', 'build', 'plan', 'general', 'default'])

// UI tool ids -> opencode tool names. Anything unmapped is dropped rather than
// passed through, so a typo cannot silently grant or revoke a capability.
export const TOOL_MAP = {
  read: 'read',
  edit: 'edit',
  write: 'write',
  bash: 'bash',
  shell: 'bash',
  terminal: 'bash',
  search: 'grep',
  grep: 'grep',
  glob: 'glob',
  list: 'list',
  web: 'webfetch',
  webfetch: 'webfetch',
  fetch: 'webfetch',
  test: 'bash',
  patch: 'edit'
}

export function slugify(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'agent'
}

/** Unique, non-reserved slug given the names already in use. */
export function uniqueSlug(name, taken = new Set()) {
  let slug = slugify(name)
  if (RESERVED_AGENTS.has(slug)) slug = `${slug}-custom`
  if (!taken.has(slug)) return slug
  let n = 2
  while (taken.has(`${slug}-${n}`)) n += 1
  return `${slug}-${n}`
}

export function mapTools(tools) {
  const out = {}
  for (const id of tools || []) {
    const mapped = TOOL_MAP[String(id).toLowerCase()]
    if (mapped) out[mapped] = true
  }
  return out
}

/** `null` when the agent has nothing usable to contribute to the config. */
export function toOpenCodeAgent(agent) {
  if (!agent || agent.active === false) return null
  const prompt = String(agent.systemPrompt || '').trim()
  if (!prompt) return null

  const entry = {
    description: String(agent.persona || agent.name || 'Custom agent').trim(),
    prompt
  }
  if (agent.model) entry.model = agent.model
  const tools = mapTools(agent.tools)
  if (Object.keys(tools).length > 0) entry.tools = tools
  return entry
}

/** Whole `agent:` map for buildConfig, skipping invalid entries. */
export function buildAgentMap(customAgents, reserved = []) {
  const taken = new Set(reserved)
  const out = {}
  for (const agent of customAgents || []) {
    const entry = toOpenCodeAgent(agent)
    if (!entry) continue
    const slug = uniqueSlug(agent.name, taken)
    taken.add(slug)
    out[slug] = entry
  }
  return out
}
