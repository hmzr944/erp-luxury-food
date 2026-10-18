import Link from 'next/link'
import { FlowLogo } from '@/components/brand/FlowLogo'
import { SiteFooter } from '@/components/site/Sections'
import { BRAND } from '@/lib/brand'

// Pages légales publiques : en-tête sobre, même pied que le site
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-[var(--radius-md)] focus:bg-[var(--color-bg-surface)] focus:px-4 focus:py-2"
      >
        Aller au contenu
      </a>
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
          <Link href="/" aria-label={`${BRAND}, accueil`}>
            <FlowLogo size={18} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="flex h-11 items-center px-3 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Retour au site
            </Link>
            <Link
              href="/inscription"
              className="flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-4 text-[15px] font-semibold text-[var(--color-text-inverse)] press"
            >
              Essayer
            </Link>
          </div>
        </div>
      </header>
      <main id="contenu">{children}</main>
      <SiteFooter />
    </div>
  )
}
