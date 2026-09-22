import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // pi-ai is ESM-only, so the main process must be an ES module too.
      lib: { entry: 'src/main/index.js', formats: ['es'], fileName: () => 'index.mjs' }
    }
  },
  preload: {
    build: {
      lib: { entry: 'src/preload/index.js' }
    }
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
