/** @type {import('next').NextConfig} */
const internalApiBaseUrl = (process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '')

const nextConfig = {
  transpilePackages: ['@workspace/ui'],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiBaseUrl}/api/:path*`,
      },
    ]
  },

}

export default nextConfig
