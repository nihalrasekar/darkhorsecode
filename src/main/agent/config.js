import { buildAgentMap } from '../../shared/agentSlug.mjs'
import { ARCHITECT_CHAT_PROMPT } from './prompts.js'

const SAFE_COMMANDS = [
  'npm run build',
  'npm run typecheck',
  'npm run lint',
  'npm run test',
  'npm test',
  'npm --version',
  'node --version',
  'git --version',
  'npx --version',
  'git status',
  'git diff',
  'git diff --stat',
  'git log --oneline',
  'git log',
  'git branch',
  'pwd',
  'ls',
  'cat',
  'echo'
]

function bashRules() {
  const rules = {}
  for (const cmd of SAFE_COMMANDS) rules[cmd] = 'allow'
  rules['npm run *'] = 'allow'
  rules['*'] = 'ask'
  return rules
}

// Claude Pro/Max sign-in authenticates the app, but Anthropic's API rejects that
// subscription OAuth token when a third-party tool sends it as a completions key
// (401 "API key is invalid") — it only works from the official Claude Code client.
// So an anthropic model is only usable with a real API key; fall back to opencode's
// own default rather than spawn a config that will fail on every message.
export function buildConfig(settings, hasApiKey = false, rulesFile = null, apiKey = '') {
  const usableModel = settings.model && (settings.provider !== 'anthropic' || hasApiKey) ? settings.model : ''
  const config = {
    $schema: 'https://opencode.ai/config.json',
    theme: 'dark',
    ...(rulesFile ? { instructions: [rulesFile] } : {}),
    permission: {
      edit: settings.requireApproval ? 'ask' : 'allow',
      webfetch: 'allow',
      websearch: 'allow',
      bash: bashRules()
    },
    ignore: settings.ignorePatterns || [],
    agent: {
      'architect-chat': {
        description: 'Read-only design discussion with the Architect — explores the project, researches, and helps think through a problem before it becomes a plan.',
        permission: {
          all: 'deny',
          read: 'allow',
          globbing: 'allow',
          grep: 'allow',
          list: 'allow',
          webfetch: 'allow',
          websearch: 'allow'
        },
        tools: { read: true, glob: true, grep: true, list: true, webfetch: true, websearch: true },
        prompt: ARCHITECT_CHAT_PROMPT
      },
      // Same restrictions as architect (read-only, no edits, no shell), but keeps the
      // normal build system prompt — used for the Builder's "Plan mode" toggle so the
      // agent can explore and propose an approach without touching the project.
      plan: {
        description: 'Read-only planning mode — explores the project and proposes an approach without changing anything.',
        permission: {
          all: 'deny',
          read: 'allow',
          globbing: 'allow',
          grep: 'allow',
          list: 'allow',
          webfetch: 'allow'
        }
      },
      // Agents the user built in Agent Studio.
      ...buildAgentMap(settings.customAgents, ['architect'])
    }
  }

  if (usableModel && typeof usableModel === 'string') {
    config.model = usableModel.includes('/') ? usableModel : `${settings.provider}/${usableModel}`
  }

  // 'custom' and 'ollama' are NOT the real 'openai' provider id — that id is reserved
  // for ChatGPT/Codex OAuth (auth.js). Reusing it here would make a local/custom model
  // ride whatever credential is signed into 'openai', which fails once a ChatGPT
  // account is signed in ("not supported when using Codex with a ChatGPT account").
  // Each gets its own provider id, backed by the generic OpenAI-compatible SDK, with
  // the model declared under .models — opencode won't generate for an undeclared model.
  const modelID = usableModel && !usableModel.includes('/') ? usableModel : ''
  if (settings.provider === 'custom' && settings.baseUrl) {
    config.provider = {
      custom: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: settings.baseUrl, apiKey: apiKey || 'custom' },
        ...(modelID ? { models: { [modelID]: {} } } : {})
      }
    }
  } else if (settings.provider === 'ollama') {
    config.provider = {
      ollama: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: settings.baseUrl || 'http://localhost:11434/v1', apiKey: 'ollama' },
        ...(modelID ? { models: { [modelID]: {} } } : {})
      }
    }
  }

  return config
}