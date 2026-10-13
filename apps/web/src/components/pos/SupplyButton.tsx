'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Truck } from '@phosphor-icons/react'
import { supplyApi, untilLabel } from '@/lib/api/supply'
import { ShopSide } from '@/components/supply/SupplyHub'
import { Sheet } from './Sheet'

// En caisse : la livraison du labo arrivée, ou la commande de demain pas
// encore envoyée avant la clôture. Un toucher ouvre la réception ou le bon.
export function SupplyButton({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false)
  const suppliers = useQuery({ queryKey: ['supply', siteId, 'suppliers'], queryFn: () => supplyApi.suppliers(siteId), staleTime: 5 * 60_000, retry: false })
  const inbox = useQuery({
    queryKey: ['supply', siteId, 'inbox'],
    queryFn: () => supplyApi.inbox(siteId),
    refetchInterval: 60_000,
    enabled: !!suppliers.data?.some((s) => s.products > 0),
  })
  if (!suppliers.data?.some((s) => s.products > 0)) return null

  const arrived = inbox.data?.toReceive.length ?? 0
  const reminder = inbox.data?.reminders[0]
  const until = reminder ? untilLabel(reminder.cutoffAt) : null // rappel : moins de 3 h avant la clôture
  const alert = arrived > 0 || !!until
  const label = arrived ? 'Livraison du labo arrivée' : until ? `Commande labo, clôture ${until}` : 'Commande labo'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'relative flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-3 text-sm font-medium',
          alert ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
        ].join(' ')}
      >
        <Truck size={18} aria-hidden />
        <span className={alert ? 'hidden lg:inline' : 'hidden xl:inline'} aria-live="polite">
          {label}
        </span>
        <span className="sr-only lg:hidden">{label}</span>
      </button>
      <Sheet open={open} title={arrived ? 'Réception' : 'Commande au labo'} onClose={() => setOpen(false)} width="lg">
        <div className="pb-2">
          <ShopSide siteId={siteId} surface />
        </div>
      </Sheet>
    </>
  )
}
