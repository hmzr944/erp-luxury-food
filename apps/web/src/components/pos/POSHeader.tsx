'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUUpLeft, CaretLeft, CloudCheck, CloudSlash, WarningCircle, SignOut } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/auth.store'
import type { SaleQueueState } from './useSaleQueue'

interface POSHeaderProps {
  siteName: string
  terminalName?: string
  queue: SaleQueueState
  onReturn: () => void
}

export function POSHeader({ siteName, terminalName, queue, onReturn }: POSHeaderProps) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const time = useClock()
  const who = [terminalName, user?.firstName].filter(Boolean).join(', ')

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-2 md:gap-3 md:px-4">
      <Link
        href="/dashboard"
        aria-label="Retour au back-office"
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
      >
        <CaretLeft size={20} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight">{siteName}</p>
        <p className="truncate text-sm text-[var(--color-text-secondary)]">
          {who}
          {time && <span className="tabular hidden sm:inline">{who ? ', ' : ''}{time}</span>}
        </p>
      </div>

      <SyncStatus queue={queue} />

      <button
        type="button"
        onClick={onReturn}
        className="flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
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
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
      >
        <SignOut size={20} />
      </button>
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
