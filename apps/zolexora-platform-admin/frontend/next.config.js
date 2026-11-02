/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // `next dev` only: send /api to the local backend, like the nginx gateway does in Docker,
  // so the browser always talks to one origin (http://localhost:3095).
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [{ source: '/api/:path*', destination: 'http://127.0.0.1:4041/api/:path*' }]
      : [];
  },
};

module.exports = nextConfig;
