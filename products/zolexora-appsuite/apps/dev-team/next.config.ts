import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@zolexora/user-auth-zolexora', '@zolexora/user-auth-firebase'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3070', 'localhost:3074'],
    },
  },
}

export default config
