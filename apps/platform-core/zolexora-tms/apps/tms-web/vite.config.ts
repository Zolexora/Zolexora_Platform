import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Dev-only proxy target for /api, e.g. http://127.0.0.1:4031 (set via Infisical or shell)
const apiProxyTarget = process.env.TMS_DEV_API_PROXY_TARGET

export default defineConfig({
  // Values come from Infisical (scripts/setup/with-infisical.sh); same keys as window.__ENV__ in Docker
  envPrefix: ['VITE_', 'TMS_AUTH_SERVICE_PUBLIC_URL', 'AUTH_SERVICE_PUBLIC_URL', 'TMS_TURNSTILE_SITE_KEY', 'TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_TMS_CLIENT_FIREBASE_', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'dev-env-config-stub',
      configureServer(server) {
        server.middlewares.use('/env-config.js', (_req, res) => {
          res.setHeader('Content-Type', 'application/javascript');
          res.end('window.__ENV__ = {};');
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // One copy of Firebase: @zolexora/auth-client and this app otherwise get separate pnpm installs, and
    // a GoogleAuthProvider from one copy is ignored by the other (popup opens without providerId).
    dedupe: ['react', 'react-dom', 'firebase'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 3031,
    proxy: apiProxyTarget ? { '/api': { target: apiProxyTarget, changeOrigin: true } } : undefined,
  },
})
