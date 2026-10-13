'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Buildings, MapPin, Printer, Key, WebhooksLogo, CreditCard, Database } from '@phosphor-icons/react'

const NAV = [
  { href: '/settings/profile',      icon: User,      label: 'Mon profil' },
  { href: '/settings/users',        icon: Users,     label: 'Équipe' },
  { href: '/settings/organization', icon: Buildings, label: 'Organisation' },
  { href: '/settings/sites',        icon: MapPin,    label: 'Sites' },
  { href: '/settings/printing',     icon: Printer,   label: 'Impression' },
  { href: '/settings/data',         icon: Database,  label: 'Données' },
  { href: '/settings/api',          icon: Key,       label: 'API' },
  { href: '/settings/webhooks',     icon: WebhooksLogo, label: 'Webhooks' },
  { href: '/settings/billing',      icon: CreditCard, label: 'Facturation' },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="w-48 shrink-0 border-r border-[var(--color-border)] py-6 px-3 space-y-0.5">
      <p className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide px-3 mb-3">
        Paramètres
      </p>
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={[
              'flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] font-body text-[13px] transition-colors',
              active
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            <Icon size={13} weight={active ? 'fill' : 'regular'} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
