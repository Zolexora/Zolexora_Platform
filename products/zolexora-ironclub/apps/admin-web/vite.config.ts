import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3040,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4060',
        changeOrigin: true,
      }
    }
  },
})
