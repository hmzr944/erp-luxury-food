'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Sous-navigation de la section Stock. Les chemins et libellés sont fixes :
// la page « Lots et dates » est livrée à part.
export const STOCK_LINKS = [
  { href: '/stock', label: 'Stock' },
  { href: '/stock/inventaire', label: 'Inventaire' },
  { href: '/stock/lots', label: 'Lots et dates' },
] as const

export function StockSubNav() {
  const pathname = usePathname() ?? ''
  const active = (href: string) => (href === '/stock' ? pathname === '/stock' : pathname.startsWith(href))

  return (
    <nav aria-label="Sections du stock" className="shrink-0 border-b border-[var(--color-border)] px-4 sm:px-6">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {STOCK_LINKS.map((l) => (
          <li key={l.href} className="shrink-0">
            <Link
              href={l.href}
              aria-current={active(l.href) ? 'page' : undefined}
              className={[
                'flex min-h-11 items-center border-b-2 px-3 font-body text-sm transition-colors',
                active(l.href)
                  ? 'border-[var(--color-accent)] font-semibold text-[var(--color-text-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
