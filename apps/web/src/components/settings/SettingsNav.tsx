'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Buildings, MapPin, Printer, Key, WebhooksLogo, Database, DeviceMobile, CreditCard, Money, ShieldCheck, Alarm as AlarmIcon } from '@phosphor-icons/react'

const NAV = [
  { href: '/settings/profile',      icon: User,      label: 'Mon profil' },
  { href: '/settings/users',        icon: Users,     label: 'Équipe' },
  { href: '/settings/organization', icon: Buildings, label: 'Organisation' },
  { href: '/settings/sites',        icon: MapPin,    label: 'Sites' },
  { href: '/settings/billing',      icon: CreditCard, label: 'Abonnement' },
  { href: '/settings/payments',     icon: DeviceMobile, label: 'Paiement' },
  { href: '/settings/cash',         icon: Money,     label: 'Fond de caisse' },
  { href: '/settings/routines',     icon: AlarmIcon, label: 'Routines et rappels' },
  { href: '/settings/printing',     icon: Printer,   label: 'Impression' },
  { href: '/settings/data',         icon: Database,  label: 'Données' },
  { href: '/settings/security',     icon: ShieldCheck, label: 'Sécurité' },
  { href: '/settings/api',          icon: Key,       label: 'API' },
  { href: '/settings/webhooks',     icon: WebhooksLogo, label: 'Webhooks' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Téléphone : rubriques en ruban horizontal */}
      <nav aria-label="Paramètres" className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] px-4 py-3 [scrollbar-width:none] md:hidden">
        {NAV.map(({ href, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-10 shrink-0 items-center rounded-[var(--radius-pill)] px-4 text-sm font-medium',
                active ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <nav aria-label="Paramètres" className="hidden w-56 shrink-0 space-y-0.5 border-r border-[var(--color-border)] px-3 py-6 md:block">
        <h2 className="mb-3 px-3 font-display text-lg font-semibold tracking-tight">Paramètres</h2>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] px-3 font-body text-[15px] transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] font-medium text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              <Icon size={18} aria-hidden weight={active ? 'fill' : 'regular'} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
