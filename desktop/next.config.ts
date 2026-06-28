import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  // Electron compatibility settings
  images: {
    unoptimized: true, // Disable image optimization for Electron
  },
  // Disable X-Powered-By header
  poweredByHeader: false,
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.vondic.ru').replace(/\/$/, '');
    const webrtcUrl = (process.env.NEXT_PUBLIC_WEBRTC_URL || 'https://webrtc.vondic.ru').replace(/\/$/, '');
    return {
      beforeFiles: [
        {
          source: '/api/webrtc/:path*',
          destination: `${webrtcUrl}/:path*`,
        },
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: '/static/:path*',
          destination: `${backendUrl}/static/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${backendUrl}/uploads/:path*`,
        },
      ]
    }
  }
}

export default nextConfig;
