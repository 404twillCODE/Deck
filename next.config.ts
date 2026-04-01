import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Dev: avoid double-mounting client components (React Strict Mode), which races Supabase
  // GoTrue’s auth token lock and breaks getSession / WebSocket token.
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
}

export default nextConfig

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
