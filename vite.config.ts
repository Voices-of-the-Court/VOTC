import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path'; // Node.js path module

export default defineConfig({
  plugins: [
    react(), // Enables React support
    electron([
      {
        // Main process configuration
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist/electron/main',
          },
        },
      },
      {
        // Preload script configuration
        entry: 'src/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete.
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/electron/preload',
          },
        },
      },
    ]),
    renderer(), // renderer plugin without page-specific options
  ],
  build: {
    outDir: 'dist/renderer', // Base output directory for renderer assets
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'src/renderer/newWindow/app.html'),
        chat: path.resolve(__dirname, 'src/renderer/chatWindow/chat.html'),
        config: path.resolve(__dirname, 'src/renderer/configWindow/config.html'),
      },
    },
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.css'],
  },
  // Ensure correct base path for assets in packaged app
  base: './',
});
