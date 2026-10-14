'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChartLine,
  ListChecks,
  Receipt,
  Storefront,
  Package,
  Warehouse,
  Plant,
  ShieldCheck,
  Buildings,
  Gear,
  ArrowsLeftRight,
  Truck,
} from '@phosphor-icons/react'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useSiteStore } from '@/stores/site.store'
import { FlowLogo } from '@/components/brand/FlowLogo'
import { sitesApi } from '@/lib/api/sites'
import { useBilling } from '@/lib/api/billing'

export const NAV = [
  { href: '/dashboard',  icon: ChartLine,   label: 'Tableau de bord' },
  { href: '/orders',     icon: ListChecks,  label: 'Commandes' },
  { href: '/supply',     icon: Truck,       label: 'Approvisionnement' },
  { href: '/invoices',   icon: Receipt,     label: 'Factures' },
  { href: '/clients',    icon: Buildings,   label: 'Clients B2B' },
  { href: '/products',   icon: Package,     label: 'Catalogue' },
  { href: '/stock',      icon: Warehouse,   label: 'Stock' },
  { href: '/allergens',  icon: Plant,       label: 'Allergènes' },
  { href: '/compliance', icon: ShieldCheck, label: 'Conformité' },
]

export const NAV_BOTTOM = [
  { href: '/settings', icon: Gear, label: 'Paramètres' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { currentSite, sites, selectSite, setSites } = useSiteStore()
  const loaded = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll, staleTime: 5 * 60_000 })
  useEffect(() => {
    if (loaded.data) setSites(loaded.data.map((s) => ({ id: s.id, name: s.name, timezone: 'Europe/Paris' })))
  }, [loaded.data, setSites])

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <nav aria-label="Navigation principale" className="hidden md:flex flex-col w-56 shrink-0 h-full border-r border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Brand + site selector */}
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <FlowLogo size={18} className="mb-5" />
        {sites.length <= 1 && (
          <p className="font-display text-base font-semibold text-[var(--color-text-primary)] leading-tight truncate">
            {currentSite?.name ?? ''}
          </p>
        )}

        {sites.length > 1 && (
          <div className="relative">
            <select
              aria-label="Boutique"
              value={currentSite?.id ?? ''}
              onChange={(e) => {
                const s = sites.find((s) => s.id === e.target.value)
                if (s) selectSite(s)
              }}
              className="w-full h-10 pl-3 pr-8 bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm appearance-none cursor-pointer"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ArrowsLeftRight
              size={14}
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Passer d'un espace à l'autre en un geste : caisse ou atelier */}
      {currentSite && sites.find((s) => s.id === currentSite.id) && loaded.data?.find((s) => s.id === currentSite.id)?.isSupplier ? (
        <div className="px-3 pt-3 pb-1">
          <Link
            href={`/atelier/${currentSite.id}`}
            className="flex items-center gap-2.5 h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Truck size={18} aria-hidden />
            <span className="font-body text-[15px]">Ouvrir l&apos;atelier</span>
          </Link>
        </div>
      ) : currentSite && (
        <div className="px-3 pt-3 pb-1">
          <Link
            href={`/pos/${currentSite.id}`}
            className="flex items-center gap-2.5 h-10 px-3 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors group"
          >
            <Storefront size={18} aria-hidden />
            <span className="font-body text-[15px]">Ouvrir la caisse</span>
          </Link>
        </div>
      )}

      {/* Navigation principale */}
      <div className="flex-1 px-3 pt-2 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex items-center gap-2.5 h-10 px-3 rounded-[var(--radius-md)] transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-indicator"
                  className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)]"
                  transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
                />
              )}
              <Icon size={18} aria-hidden weight={active ? 'fill' : 'regular'} />
              <span className="font-body text-[15px]">{label}</span>
            </Link>
          )
        })}
      </div>

      {/* Navigation bas */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-[var(--color-border)] pt-3">
        <BillingNotice />
        {NAV_BOTTOM.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2.5 h-10 px-3 rounded-[var(--radius-md)] transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <Icon size={18} aria-hidden weight={active ? 'fill' : 'regular'} />
              <span className="font-body text-[15px]">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Essai ou paiement en attente : visible sans être bloquant
function BillingNotice() {
  const { data } = useBilling()
  if (!data || data.status === 'ACTIVE') return null
  const text =
    data.status === 'TRIALING'
      ? data.trialDaysLeft
        ? `Essai : ${data.trialDaysLeft} ${data.trialDaysLeft > 1 ? 'jours' : 'jour'}`
        : 'Essai terminé'
      : data.status === 'PAST_DUE'
        ? 'Paiement en attente'
        : 'Abonnement arrêté'
  return (
    <Link
      href="/settings/billing"
      className="mb-1 block rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]"
    >
      {text}
    </Link>
  )
}
