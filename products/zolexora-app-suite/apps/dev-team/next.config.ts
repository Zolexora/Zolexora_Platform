import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3071', 'localhost:3070'],
    },
  },
}

export default config
