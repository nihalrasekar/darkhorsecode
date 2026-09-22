/**
 * Turn a build prompt's opening line into a short project name, so starting a
 * new project from a prompt ("create a pomodoro app") never needs a separate
 * "name your project" step.
 */

const FILLER_LEAD =
  /^(please\s+)?((can|could)\s+you\s+|i\s+(want|need)\s+(to\s+)?)?(create|build|make|generate|write|develop|design|start|scaffold)?\b\s*(me\s+)?(an?\s+|the\s+)?/i

const MAX_WORDS = 5

export function deriveProjectName(prompt) {
  const firstLine = String(prompt || '').split('\n')[0] || ''
  const stripped = firstLine.trim().replace(FILLER_LEAD, '').replace(/[.!?]+$/, '')
  const words = stripped.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS)
  if (!words.length) return 'New App'
  return words.map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}
