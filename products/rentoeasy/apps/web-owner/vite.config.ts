import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import path             from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':             path.resolve(__dirname, './src'),
      '@zolexora/rentoeasy-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@zolexora/rentoeasy-utils': path.resolve(__dirname, '../../packages/shared-utils/src/index.ts'),
    },
  },
  server: { port: 3002 },
})
