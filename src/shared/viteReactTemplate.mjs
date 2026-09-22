/**
 * The starter every new project is created from: Vite + React + Tailwind v4, plain JS.
 *
 * Kept as string literals rather than files on disk so it bundles straight into the
 * main process and needs no packaging rules. `__PROJECT_NAME__` is the only placeholder.
 */

const NAME = '__PROJECT_NAME__'

/** npm package names: lowercase, no spaces, no leading dots or underscores. */
export function packageName(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'app'
}

const FILES = {
  'package.json': `{
  "name": "${NAME}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
`,

  'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The host app hands us a free port through PORT; fall back to vite's default.
    port: Number(process.env.PORT) || 5173,
    host: '127.0.0.1'
  }
})
`,

  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${NAME}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,

  'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,

  'src/App.jsx': `export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight">${NAME}</h1>
      <p className="text-sm text-zinc-400">Edit src/App.jsx and this page updates instantly.</p>
    </main>
  )
}
`,

  'src/index.css': `@import "tailwindcss";
`,

  '.gitignore': `node_modules
dist
.DS_Store
*.log
`
}

/** Template files for a project, as { relativePath: contents }. */
export function applyTemplate(name) {
  const pkg = packageName(name)
  const title = String(name || '').trim() || pkg
  const out = {}
  for (const [file, body] of Object.entries(FILES)) {
    // package.json needs the npm-safe slug; everywhere else reads as a heading.
    out[file] = body.split(NAME).join(file === 'package.json' ? pkg : title)
  }
  return out
}
