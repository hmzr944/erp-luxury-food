import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ws = (process.env.NEXT_PUBLIC_WS_URL ?? api).replace(/^http/, 'ws')
// FLŌW-Bridge, l'agent local de la boutique (imprimante, tiroir, TPE)
const bridge = process.env.NEXT_PUBLIC_BRIDGE_URL || 'ws://127.0.0.1:51717'

// Politique de contenu : scripts et styles du site seulement (Next a besoin
// d'« inline »), images des fiches produit en https, connexions vers l'API et vers le pont local.
// Ni iframe tierce, ni objet, ni formulaire vers ailleurs.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${api} ${ws} ${bridge}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Seulement si l'API est elle-même en https (sinon les appels seraient cassés)
  ...(api.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ')

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Caméra : lecture des cartes QR à la caisse. Le reste est coupé.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ...(isProd
    ? [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ]
    : []),
]

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Version jointe aux demandes d'aide (lancé par pnpm : version du paquet)
  env: { NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || 'dev' },
  transpilePackages: ['@erp/ui', '@erp/utils', '@erp/types'],
  // Requis pour le Dockerfile multi-stage (copie .next/standalone)
  output: isProd ? 'standalone' : undefined,
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  async headers() {
    return [{ source: '/:path*', headers: security }]
  },
}

export default config
