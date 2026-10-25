import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  // Tell Next.js/webpack to transpile the local workspace package
  // (it ships raw TypeScript with .js ESM imports — webpack needs to handle it)
  transpilePackages: ['@zolexora/user-auth-zolexora'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3070'],
    },
  },
}

export default config
