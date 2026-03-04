import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    // Игнорировать ошибки типов во время сборки
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
