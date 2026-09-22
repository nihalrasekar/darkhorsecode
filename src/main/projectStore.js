import { app, dialog, ipcMain, shell } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { applyTemplate, packageName } from '../shared/viteReactTemplate.mjs'
import { deriveProjectName } from '../shared/projectName.mjs'

function storePath() {
  return path.join(app.getPath('userData'), 'projects.json')
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data.recentProjects)) return { recentProjects: [] }
    return data
  } catch {
    return { recentProjects: [] }
  }
}

function writeStore(data) {
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2))
}

function touchRecent(store, { path: projectPath, name }) {
  store.recentProjects = store.recentProjects.filter((p) => p.path !== projectPath)
  store.recentProjects.unshift({ path: projectPath, name, lastOpenedAt: new Date().toISOString() })
  store.recentProjects = store.recentProjects.slice(0, 10)
  return store
}

// Only these git subcommands are reachable from the renderer, and never through a shell.
const GIT_OPS = {
  status: () => ['status', '--porcelain=v1', '--untracked-files=all'],
  diff: (file) => ['diff', '--no-color', '--', file],
  'diff-staged': (file) => ['diff', '--no-color', '--staged', '--', file],
  add: (file) => ['add', '--', file],
  restore: (file) => ['restore', '--worktree', '--', file]
}

function runGit(cwd, args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return resolve({ error: (stderr || err.message).trim() })
      resolve({ stdout: stdout || '', stderr: stderr || '' })
    })
  })
}

/** Write the vite-react template into a freshly created, empty directory. Rolls the
 * directory back on any write failure so a project is never left half-scaffolded. */
function scaffold(projectPath, name) {
  try {
    for (const [file, body] of Object.entries(applyTemplate(name))) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, body)
    }
    return null
  } catch (err) {
    fs.rmSync(projectPath, { recursive: true, force: true })
    return err.message
  }
}

export function registerProjectHandlers() {
  ipcMain.handle('project:remove-recent', (_event, { path: projectPath }) => {
    try {
      const store = readStore()
      store.recentProjects = store.recentProjects.filter((p) => p.path !== projectPath)
      writeStore(store)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:reveal', (_event, { path: target }) => {
    try {
      if (!fs.existsSync(target)) return { error: 'missing' }
      shell.showItemInFolder(target)
      return { ok: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:git', async (_event, { directory, op, file }) => {
    try {
      const build = GIT_OPS[op]
      if (!build) return { error: `unsupported git op: ${op}` }
      if (!directory || !fs.existsSync(directory)) return { error: 'missing-directory' }
      if (op !== 'status' && (!file || typeof file !== 'string')) return { error: 'missing-file' }
      return await runGit(directory, build(file))
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:list-recent', () => {
    try {
      const store = readStore()
      return store.recentProjects.map((p) => ({ ...p, exists: fs.existsSync(p.path) }))
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:open-existing', async () => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || !result.filePaths[0]) return { canceled: true }
      const projectPath = result.filePaths[0]
      const name = path.basename(projectPath)
      const store = touchRecent(readStore(), { path: projectPath, name })
      writeStore(store)
      return { canceled: false, project: { path: projectPath, name } }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:create-new', async (_event, { name }) => {
    try {
      const trimmed = (name || '').trim()
      if (!trimmed) return { error: 'invalid-name' }

      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || !result.filePaths[0]) return { canceled: true }

      const parentDir = result.filePaths[0]
      const projectPath = path.join(parentDir, trimmed)
      if (fs.existsSync(projectPath)) return { canceled: false, error: 'exists' }

      fs.mkdirSync(projectPath, { recursive: false })
      const scaffoldErr = scaffold(projectPath, trimmed)
      if (scaffoldErr) return { canceled: false, error: scaffoldErr }
      const store = touchRecent(readStore(), { path: projectPath, name: trimmed })
      writeStore(store)
      return { canceled: false, project: { path: projectPath, name: trimmed } }
    } catch (err) {
      return { error: err.message }
    }
  })

  // The other half of "type an idea and go": no name prompt — the project name
  // comes from the prompt itself — but the user still picks where it's saved.
  ipcMain.handle('project:create-from-prompt', async (_event, { prompt }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose where to create the project'
      })
      if (result.canceled || !result.filePaths[0]) return { canceled: true }

      const name = deriveProjectName(prompt)
      const baseDir = result.filePaths[0]

      let slug = packageName(name)
      let projectPath = path.join(baseDir, slug)
      for (let n = 2; fs.existsSync(projectPath); n++) {
        projectPath = path.join(baseDir, `${slug}-${n}`)
      }

      fs.mkdirSync(projectPath, { recursive: false })
      const scaffoldErr = scaffold(projectPath, name)
      if (scaffoldErr) return { error: scaffoldErr }
      const store = touchRecent(readStore(), { path: projectPath, name })
      writeStore(store)
      return { project: { path: projectPath, name } }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('project:open-recent', async (_event, { path: projectPath }) => {
    try {
      if (!fs.existsSync(projectPath)) return { error: 'missing' }
      const name = path.basename(projectPath)
      const store = touchRecent(readStore(), { path: projectPath, name })
      writeStore(store)
      return { project: { path: projectPath, name } }
    } catch (err) {
      return { error: err.message }
    }
  })
}
