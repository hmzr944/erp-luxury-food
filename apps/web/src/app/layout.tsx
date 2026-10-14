import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { Providers } from '@/lib/providers'
import { BRAND } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s | ${BRAND}` },
  description: 'Caisse et gestion pour les commerces',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F2ED' },
    { media: '(prefers-color-scheme: dark)', color: '#14141A' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        {/* Police de l'interface préchargée : pas de saut au premier affichage */}
        <link rel="preload" href="/fonts/funnel-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/funnel-display-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
