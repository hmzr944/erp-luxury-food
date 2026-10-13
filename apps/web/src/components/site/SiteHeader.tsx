import Link from 'next/link'
import { BRAND } from '@/lib/brand'

const NAV = [
  { href: '#fonctions', label: 'La caisse' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#demarrer', label: 'Démarrer' },
  { href: '#questions', label: 'Questions' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--base-bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {BRAND}
        </Link>
        <nav aria-label="Sections" className="hidden flex-1 items-center gap-6 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[15px] text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)]">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/login" className="flex h-11 items-center px-3 text-[15px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--color-text-primary)] px-4 text-[15px] font-semibold text-[var(--color-bg-base)] transition-transform duration-150 active:scale-[0.97]"
          >
            Essayer
          </Link>
        </div>
      </div>
    </header>
  )
}
