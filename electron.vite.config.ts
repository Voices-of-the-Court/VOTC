import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@llmTypes': resolve('src/main/llmProviders/types.ts')
      }
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main'
    }
  },
  preload: {
    resolve: {
      alias: {
        '@llmTypes': resolve('src/main/llmProviders/types.ts')
      }
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@llmTypes': resolve('src/main/llmProviders/types.ts')
      }
    },
    build: {
      outDir: 'out/renderer'
    },
    plugins: [react()],
    server: {
      watch: {
        usePolling: true
      }
    }
  }
})
