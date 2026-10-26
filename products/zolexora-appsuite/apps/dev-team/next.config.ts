import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@zolexora/user-auth-zolexora', '@zolexora/user-auth-firebase'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3071', 'localhost:3070'],
    },
  },
}

export default config
