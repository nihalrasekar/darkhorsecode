import fs from 'fs'
import path from 'path'

function specPath(directory) {
  return path.join(directory, '.darkhorse', 'architecture.json')
}

export function readArchitecture(directory) {
  const dir = specPath(directory)
  try {
    const raw = JSON.parse(fs.readFileSync(dir, 'utf-8'))
    return normalizeTree(raw)
  } catch {
    // skeleton()'s leaf nodes omit `children` (they have none) — normalize it like
    // any other tree so the renderer's `node.children.length` always has an array.
    return normalizeTree(skeleton(directory))
  }
}

function normalizeTree(node, depth = 0) {
  if (!node || typeof node !== 'object') return null
  const n = {
    id: node.id || slug(node.label || 'node'),
    label: String(node.label || 'Untitled'),
    kind: ['client', 'server', 'database', 'infra', 'shared', 'root'].includes(node.kind) ? node.kind : 'shared',
    applied: node.applied !== false,
    description: String(node.description || ''),
    children: []
  }
  if (node.children && Array.isArray(node.children) && depth < 6) {
    n.children = node.children.map((c) => normalizeTree(c, depth + 1)).filter(Boolean)
  }
  return n
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `node-${Math.random().toString(36).slice(2, 7)}`
}

function hasAny(directory, names) {
  return names.some((name) => fs.existsSync(path.join(directory, name)))
}

function readPkg(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8'))
  } catch {
    return null
  }
}

function evidence(directory) {
  const deps = readPkg(directory)
  const depAll = { ...(deps?.dependencies || {}), ...(deps?.devDependencies || {}) }
  const hasDep = (...names) => names.some((n) => depAll[n])

  const frontend = hasAny(directory, ['index.html', 'vite.config.js', 'vite.config.ts', 'next.config.js', 'tailwind.config.js', 'src/App.jsx', 'src/App.tsx', 'src/main.jsx', 'app/(pages)', 'pages']) || hasDep('react', 'vue', 'svelte', 'next', 'gatsby', 'expo')
  const backend = hasAny(directory, ['server.js', 'server.ts', 'app.js', 'app.ts', 'api/', 'routes/', 'src/server', 'src/api']) || hasDep('express', 'fastify', 'hapi', 'koa', 'nest', '@nestjs/core')
  const database = hasAny(directory, ['prisma/', 'drizzle/', 'migrations/', 'schema.sql', 'seed.sql', '*.db']) || hasDep('prisma', 'knex', 'typeorm', 'drizzle-orm', 'pg', 'mysql2', 'mongodb', 'supabase')
  const deploy = hasAny(directory, ['vercel.json', 'Dockerfile', 'docker-compose.yml', '.github/workflows'])
  const auth = hasAny(directory, ['src/lib/auth', 'src/auth', 'middleware/auth']) || hasDep('next-auth', 'passport', 'clerk', 'auth0', 'lucia')
  const ui = hasAny(directory, ['src/components', 'src/App.jsx', 'src/App.tsx', 'components/'])
  const state = hasDep('redux', 'zustand', 'jotai', 'mobx', 'recoil', 'pinia', '@reduxjs/toolkit')

  return { frontend, backend, database, deploy, auth, ui, state }
}

export function skeleton(directory) {
  const e = evidence(directory)
  const projectName = path.basename(directory) || 'App'

  const root = {
    id: 'root',
    label: projectName,
    kind: 'root',
    applied: true,
    description: 'High-level view of the app: two columns for the client and the server. Open a node to reveal the next layer down.',
    children: []
  }

  const frontend = {
    id: 'frontend',
    label: 'Frontend',
    kind: 'client',
    applied: e.frontend,
    description: e.frontend
      ? 'Everything the user sees and interacts with: screens, layout, and client-side behaviour.'
      : 'Planned client layer. Not applied yet — the app has no UI code so far.',
    children: [
      {
        id: 'frontend-ui',
        label: 'UI layer',
        kind: 'client',
        applied: e.ui,
        description: e.ui
          ? 'Reusable components and the app shell that render screens and respond to user input.'
          : 'Planned component tree for screens and shared widgets.'
      },
      {
        id: 'frontend-state',
        label: 'State',
        kind: 'client',
        applied: e.state,
        description: e.state
          ? 'Client-side state management: what data lives in memory and how it stays in sync.'
          : 'Planned client state handling for cached data and UI flags.'
      }
    ]
  }

  const backend = {
    id: 'backend',
    label: 'Backend',
    kind: 'server',
    applied: e.backend,
    description: e.backend
      ? 'Server-side logic that handles requests, enforces rules, and talks to data stores.'
      : 'Planned server layer. Not applied yet — no server code found.',
    children: [
      {
        id: 'backend-app',
        label: 'Application server',
        kind: 'server',
        applied: e.backend,
        description: e.backend
          ? 'HTTP layer: routes, business logic, validation, and orchestration.'
          : 'Planned application server for request handling and business logic.'
      },
      {
        id: 'backend-db',
        label: 'Database server',
        kind: 'database',
        applied: e.database,
        description: e.database
          ? 'Persistence: the actual data store, its schema, and how models map to it.'
          : 'Planned database server for durable storage.'
      },
      {
        id: 'backend-auth',
        label: 'Auth / identity',
        kind: 'shared',
        applied: e.auth,
        description: e.auth
          ? 'Authentication and authorisation: signs users in and gates protected resources.'
          : 'Planned auth flow for identity and access control.'
      }
    ]
  }

  root.children = [frontend, backend]

  if (e.deploy) {
    root.children.push({
      id: 'deploy',
      label: 'Deployment',
      kind: 'infra',
      applied: true,
      description: 'How the app is shipped and served in production.',
      children: [
        {
          id: 'deploy-hosting',
          label: 'Hosting',
          kind: 'infra',
          applied: true,
          description: 'Where frontend and backend are hosted, and how builds get there.'
        }
      ]
    })
  }

  return root
}

