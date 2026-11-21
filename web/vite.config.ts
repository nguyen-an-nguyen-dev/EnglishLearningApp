import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        cosmeticsPreview: resolve(rootDir, 'cosmetics-preview.html'),
      },
    },
  },
  server: {
    watch: {
      // Editors (this agent tool included) stage writes in `.<file>.tmpdir/`
      // inside the same folder, then rename. Watching those transient files
      // throws EBUSY and can wedge the whole dev server, so they stay unseen.
      ignored: ['**/.*.tmpdir/**', '**/.*.tmpdir', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
