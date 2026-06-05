import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Electron compatibility settings
  images: {
    unoptimized: true, // Disable image optimization for Electron
  },
  // Disable X-Powered-By header
  poweredByHeader: false,
  // Set asset prefix for Electron production build
  assetPrefix: process.env.ELECTRON_BUILD ? './' : undefined,
}

export default nextConfig;
