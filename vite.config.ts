import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local backend (nexus-7-backend). Override with BACKEND_URL if you run it on another port.
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/preview': { target: backend, changeOrigin: true },
    },
  },
})
