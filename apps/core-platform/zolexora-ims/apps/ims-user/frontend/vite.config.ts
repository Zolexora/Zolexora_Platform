import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Values come from Infisical (scripts/setup/with-infisical.sh); same keys as window.__ENV__ in Docker
  envPrefix: ['VITE_', 'AUTH_SERVICE_PUBLIC_URL', 'TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_IMS_CLIENT_FIREBASE_', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  plugins: [react()],
  resolve: {
    // One copy of React and Firebase shared with @zolexora/auth-client.
    dedupe: ['react', 'react-dom', 'firebase'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:4050',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
