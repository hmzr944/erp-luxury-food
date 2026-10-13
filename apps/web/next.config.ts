import type { NextConfig } from 'next'

const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@erp/ui', '@erp/utils', '@erp/types'],
  // Requis pour le Dockerfile multi-stage (copie .next/standalone)
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
}

export default config
