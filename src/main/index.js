import { app, shell, BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { registerProjectHandlers } from './projectStore'
import { registerAgent } from './agent'
import { registerDevServerHandlers, stopDevServer } from './devServer'
import { runtime } from './agent/opencodeRuntime'

// Not named __dirname: electron-vite auto-injects a CJS shim into any bundle whose
// TEXT contains the literal substrings __dirname/__filename/require(, matched with a
// plain regex rather than real AST analysis — so it fires even on unrelated string
// data (it did, on the vite-template string in src/shared/viteReactTemplate.mjs) and
// then inserts the shim at the last textual "import" match, which can land inside
// that string instead of real code. Using our own name sidesteps the scan entirely.
const appDir = dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    title: 'DarkHorseCode',
    icon: join(appDir, '../../resources/icon.png'),
    webPreferences: {
      preload: join(appDir, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // The Builder preview hosts the project's own dev server in a <webview>.
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
      console.log(`[renderer] ${message} (${sourceId}:${line})`)
    })
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[renderer] process gone:', details.reason)
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(appDir, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.darkhorsecode.app')
  registerProjectHandlers()
  registerAgent()
  registerDevServerHandlers({
    broadcast: (channel, payload) => {
      for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
    }
  })
  runtime.start().catch((err) => console.error('Agent runtime failed to start:', err.message))
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopDevServer()
  runtime.stop()
})

app.on('will-quit', () => {
  stopDevServer()
  runtime.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
