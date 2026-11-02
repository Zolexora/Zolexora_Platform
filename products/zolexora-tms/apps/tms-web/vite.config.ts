import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Dev-only proxy target for /api, e.g. http://127.0.0.1:4030 (set via Infisical or shell)
const apiProxyTarget = process.env.TMS_DEV_API_PROXY_TARGET

export default defineConfig({
  // Values come from Infisical (scripts/setup/with-infisical.sh); same keys as window.__ENV__ in Docker
  envPrefix: ['VITE_', 'AUTH_SERVICE_PUBLIC_URL', 'TURNSTILE_SITE_KEY'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    proxy: apiProxyTarget ? { '/api': { target: apiProxyTarget, changeOrigin: true } } : undefined,
  },
})
