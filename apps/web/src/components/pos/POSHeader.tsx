'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUUpLeft, CaretLeft, CloudCheck, CloudSlash, DotsThreeVertical, Money, UserSwitch, WarningCircle, SignOut } from '@phosphor-icons/react'
import { Sheet } from './Sheet'
import { FlowMark } from '@/components/brand/FlowLogo'
import { useAuthStore } from '@/stores/auth.store'
import type { SaleQueueState } from './useSaleQueue'
import { SupplyButton } from './SupplyButton'

interface POSHeaderProps {
  siteName: string
  terminalName?: string
  siteId: string
  queue: SaleQueueState
  onReturn: () => void
  cashOpen: boolean | null // null : inconnu (hors ligne)
  onCash: () => void
  onSwitchUser: () => void
}

export function POSHeader({ siteName, siteId, terminalName, queue, onReturn, cashOpen, onCash, onSwitchUser }: POSHeaderProps) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const time = useClock()
  const [menu, setMenu] = useState(false)
  const who = [terminalName, user?.firstName].filter(Boolean).join(', ')

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2 md:gap-3 md:px-4">
      {/* Le vendeur reste dans la caisse ; le gérant revient au back-office */}
      {user?.role !== 'SELLER' && (
        <Link
          href="/dashboard"
          aria-label="Retour au back-office"
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          <CaretLeft size={20} />
        </Link>
      )}
      <FlowMark size={30} tile className="hidden sm:block" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] font-semibold leading-tight">{siteName}</p>
        <p className="truncate text-sm text-[var(--color-text-secondary)]">
          {who}
          {time && <span className="tabular hidden sm:inline">{who ? ', ' : ''}{time}</span>}
        </p>
      </div>

      <SyncStatus queue={queue} />

      {queue.online && <SupplyButton siteId={siteId} />}

      {cashOpen !== null && (
        <button
          type="button"
          onClick={onCash}
          className="hidden h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] sm:flex"
        >
          <Money size={18} aria-hidden />
          <span className="hidden xl:inline">{cashOpen ? 'Fermer la caisse' : 'Ouvrir la caisse'}</span>
          <span className="sr-only xl:hidden">{cashOpen ? 'Fermer la caisse' : 'Ouvrir la caisse'}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onSwitchUser}
        aria-label="Changer de vendeur"
        className="hidden size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] sm:grid"
      >
        <UserSwitch size={20} />
      </button>

      <button
        type="button"
        onClick={onReturn}
        className="hidden h-11 shrink-0 sm:flex items-center gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
      >
        <ArrowUUpLeft size={18} aria-hidden />
        <span className="hidden sm:inline">Retour</span>
        <span className="sr-only sm:hidden">Retour d&apos;article</span>
      </button>

      <button
        type="button"
        onClick={() => {
          logout()
          router.push('/login')
        }}
        aria-label="Se déconnecter"
        className="hidden size-11 shrink-0 sm:grid place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
      >
        <SignOut size={20} />
      </button>
      {/* Téléphone : les actions secondaires dans un menu, le nom de la boutique reste lisible */}
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label="Plus d'actions"
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] sm:hidden"
      >
        <DotsThreeVertical size={22} weight="bold" />
      </button>
      <Sheet open={menu} title="Caisse" onClose={() => setMenu(false)}>
        <ul className="divide-y divide-[var(--color-border)] pb-2">
          {[
            ...(cashOpen !== null ? [{ label: cashOpen ? 'Fermer la caisse' : 'Ouvrir la caisse', icon: Money, run: onCash }] : []),
            { label: "Retour d'article", icon: ArrowUUpLeft, run: onReturn },
            { label: 'Changer de vendeur', icon: UserSwitch, run: onSwitchUser },
            {
              label: 'Se déconnecter',
              icon: SignOut,
              run: () => {
                logout()
                router.push('/login')
              },
            },
          ].map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => {
                  setMenu(false)
                  a.run()
                }}
                className="flex h-14 w-full items-center gap-3 text-left text-[17px] font-medium"
              >
                <a.icon size={22} aria-hidden className="text-[var(--color-text-secondary)]" />
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </header>
  )
}

// L'état du réseau n'empêche jamais de vendre : on informe, sans alarmer
function SyncStatus({ queue }: { queue: SaleQueueState }) {
  const { online, pending, rejected, flush } = queue
  let Icon = CloudCheck
  let label = 'En ligne'
  if (rejected > 0) {
    Icon = WarningCircle
    label = `${rejected} ${rejected > 1 ? 'ventes refusées' : 'vente refusée'}, à vérifier`
  } else if (!online) {
    Icon = CloudSlash
    label = pending ? `Hors ligne, ${pending} à envoyer` : 'Hors ligne'
  } else if (pending > 0) {
    label = `${pending} à envoyer`
  }
  const attention = rejected > 0 || !online

  return (
    <button
      type="button"
      onClick={flush}
      title="Envoyer maintenant"
      className={[
        'flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium',
        attention
          ? 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      <Icon size={18} aria-hidden weight={rejected > 0 ? 'fill' : 'regular'} />
      <span className={attention ? '' : 'hidden sm:inline'} aria-live="polite">
        <span className={attention ? 'hidden sm:inline' : ''}>{label}</span>
        {attention && <span className="sm:hidden">{rejected > 0 ? 'À vérifier' : 'Hors ligne'}</span>}
      </span>
    </button>
  )
}

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    update()
    const id = window.setInterval(update, 15_000)
    return () => window.clearInterval(id)
  }, [])
  return time
}
