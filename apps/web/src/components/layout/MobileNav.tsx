'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { DotsThreeOutline, Storefront } from '@phosphor-icons/react'
import { Sheet } from '@/components/pos/Sheet'
import { FlowLogo } from '@/components/brand/FlowLogo'
import { useSiteStore } from '@/stores/site.store'
import { NAV, NAV_BOTTOM } from './Sidebar'

// Téléphone : la barre latérale laisse place à une barre d'onglets en bas
// (les quatre écrans les plus ouverts) et à « Plus » pour le reste
const MAIN = ['/dashboard', '/orders', '/products', '/supply']

export function MobileNav() {
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  const { currentSite, sites, selectSite } = useSiteStore()
  const isActive = (href: string) => pathname.startsWith(href)
  const main = NAV.filter((n) => MAIN.includes(n.href))
  const rest = [...NAV.filter((n) => !MAIN.includes(n.href)), ...NAV_BOTTOM]
  const moreActive = rest.some((n) => isActive(n.href))

  const tab = 'relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium'
  return (
    <>
      <header className="flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 md:hidden">
        <FlowLogo size={18} />
        {currentSite && <p className="truncate font-display text-base font-semibold">{currentSite.name}</p>}
      </header>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {main.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`${tab} ${active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
              {/* Le trait Klein du Ō marque l'onglet actif */}
              {active && <span aria-hidden className="absolute top-0 h-1 w-8 rounded-b-full bg-[var(--color-accent)]" />}
              <Icon size={22} aria-hidden weight={active ? 'fill' : 'regular'} />
              <span className="max-w-full truncate px-1">{label === 'Tableau de bord' ? 'Accueil' : label === 'Approvisionnement' ? 'Appro' : label === 'Commandes' ? 'Ventes' : label}</span>
            </Link>
          )
        })}
        <button type="button" onClick={() => setMore(true)} className={`${tab} ${moreActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
          {moreActive && <span aria-hidden className="absolute top-0 h-1 w-8 rounded-b-full bg-[var(--color-accent)]" />}
          <DotsThreeOutline size={22} aria-hidden weight={moreActive ? 'fill' : 'regular'} />
          Plus
        </button>
      </nav>

      <Sheet open={more} title="Menu" onClose={() => setMore(false)}>
        <div className="space-y-4 pb-2">
          {sites.length > 1 && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Boutique</span>
              <select
                value={currentSite?.id ?? ''}
                onChange={(e) => {
                  const s = sites.find((x) => x.id === e.target.value)
                  if (s) selectSite(s)
                }}
                className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {currentSite && (
            <Link
              href={`/pos/${currentSite.id}`}
              className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[15px] font-semibold text-[var(--color-on-accent)] press"
            >
              <Storefront size={20} aria-hidden /> Ouvrir la caisse
            </Link>
          )}
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            {rest.map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMore(false)}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className="flex h-12 items-center gap-3 px-4 text-[15px] font-medium"
                >
                  <Icon size={20} aria-hidden weight={isActive(href) ? 'fill' : 'regular'} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
