import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  generateEtags: false,
  cleanDistDir: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
