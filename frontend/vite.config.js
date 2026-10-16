import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, Vite proxies /api to the local FastAPI so the browser only ever
// talks to one origin, same as Nginx/Ingress do in Docker and Kubernetes.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
