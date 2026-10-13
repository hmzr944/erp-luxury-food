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
import { sitesApi } from '@/lib/api/sites'
import { useBilling } from '@/lib/api/billing'

const NAV = [
  { href: '/dashboard',  icon: ChartLine,   label: 'Dashboard' },
  { href: '/orders',     icon: ListChecks,  label: 'Commandes' },
  { href: '/supply',     icon: Truck,       label: 'Approvisionnement' },
  { href: '/invoices',   icon: Receipt,     label: 'Factures' },
  { href: '/clients',    icon: Buildings,   label: 'Clients B2B' },
  { href: '/products',   icon: Package,     label: 'Catalogue' },
  { href: '/stock',      icon: Warehouse,   label: 'Stock' },
  { href: '/allergens',  icon: Plant,       label: 'Allergènes' },
  { href: '/compliance', icon: ShieldCheck, label: 'Conformité' },
]

const NAV_BOTTOM = [
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
    <nav className="flex flex-col w-48 shrink-0 h-full border-r border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Brand + site selector */}
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <p className="font-display text-sm text-[var(--color-text-primary)] leading-tight mb-2 truncate">
          {currentSite?.name ?? 'FLŌW'}
        </p>

        {sites.length > 1 && (
          <div className="relative">
            <select
              value={currentSite?.id ?? ''}
              onChange={(e) => {
                const s = sites.find((s) => s.id === e.target.value)
                if (s) selectSite(s)
              }}
              className="w-full h-7 pl-2 pr-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-sm)] font-body text-[11px] text-[var(--color-text-secondary)] appearance-none focus:outline-none focus:border-[var(--color-accent)]/40 cursor-pointer"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ArrowsLeftRight
              size={10}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Caisse CTA */}
      {currentSite && (
        <div className="px-3 pt-3 pb-1">
          <Link
            href={`/pos/${currentSite.id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] border border-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors group"
          >
            <Storefront size={14} weight="regular" />
            <span className="font-body text-[13px]">Ouvrir la caisse</span>
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
              className={[
                'relative flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--color-accent)] rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={14} weight={active ? 'fill' : 'regular'} />
              <span className="font-body text-[13px]">{label}</span>
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
                'flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <Icon size={14} weight={active ? 'fill' : 'regular'} />
              <span className="font-body text-[13px]">{label}</span>
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
      className="mb-1 block rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]"
    >
      {text}
    </Link>
  )
}
