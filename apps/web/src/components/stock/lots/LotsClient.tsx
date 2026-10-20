'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hourglass, Plus, Prohibit, Package, ArrowsClockwise } from '@phosphor-icons/react'
import { lotsApi, type LotFilter, type LotRow } from '@/lib/api/lots'
import { useAuthStore } from '@/stores/auth.store'
import { LotBadge } from './LotBadge'
import { LossSheet } from './LossSheet'
import { ReceiveLotSheet } from './ReceiveLotSheet'
import { dateKindLabel, formatDay, lotTitle, quantityLabel, statusDetail, statusLabel } from './lots-view'

const FILTERS: Array<{ key: LotFilter; label: string; count: (c: { all: number; expired: number; week: number; month: number }) => number }> = [
  { key: 'all', label: 'Tous', count: (c) => c.all },
  { key: 'expired', label: 'Périmés', count: (c) => c.expired },
  { key: '7', label: 'Dans 7 jours', count: (c) => c.week },
  { key: '30', label: 'Dans 30 jours', count: (c) => c.month },
]

const EMPTY: Record<LotFilter, string> = {
  all: 'Aucun lot en stock.',
  expired: 'Aucun lot périmé.',
  '7': 'Aucun lot n’expire dans les 7 prochains jours.',
  '30': 'Aucun lot n’expire dans les 30 prochains jours.',
}

export function LotsClient({ siteId }: { siteId: string }) {
  const role = useAuthStore((s) => s.user?.role)
  const canWrite = role === 'OWNER' || role === 'MANAGER'
  const [filter, setFilter] = useState<LotFilter>('all')
  const [receiving, setReceiving] = useState<{ productId?: string } | null>(null)
  const [losing, setLosing] = useState<LotRow | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['lots', siteId, filter],
    queryFn: () => lotsApi.list(siteId, filter),
    // Les compteurs et « à écouler » viennent de la même réponse : on la garde en attendant la suivante
    placeholderData: (prev) => prev,
  })
  const lots = data?.lots ?? []
  const toClear = data?.toClear ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="page-title">Lots et dates</h1>
          <p className="mt-0.5 font-body text-sm text-[var(--color-text-secondary)]">
            {data ? `${data.counts.all} lot${data.counts.all > 1 ? 's' : ''} en stock` : 'Dates limites du stock'}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setReceiving({})}
            className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={16} weight="bold" aria-hidden />
            Réceptionner un lot
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {toClear.length > 0 && (
          <section aria-labelledby="clear-title" className="border-b border-[var(--color-border)] bg-[var(--color-accent-muted)] px-4 py-4 sm:px-6">
            <h2 id="clear-title" className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
              <Hourglass size={18} aria-hidden />
              À écouler cette semaine
            </h2>
            <p className="mt-0.5 font-body text-sm text-[var(--color-text-secondary)]">
              Produits dont un lot expire dans les 7 jours : à proposer en premier, en promotion ou en avant de rayon.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {toClear.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold">{p.name}</p>
                    <p className="tabular font-body text-sm text-[var(--color-text-secondary)]">
                      {quantityLabel(p.quantity, p.unit)} à vendre{p.lots > 1 ? ` · ${p.lots} lots` : ''}
                    </p>
                  </div>
                  <LotBadge status={p.daysLeft === 0 ? 'TODAY' : 'SOON'} daysLeft={p.daysLeft} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div role="group" aria-label="Filtrer les lots" className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-body text-sm font-medium whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              {f.label}
              {data && <span className="tabular text-xs opacity-70">{f.count(data.counts)}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2 px-4 pb-6 sm:px-6" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-surface)]" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="font-body text-sm">Les lots n’ont pas pu être chargés.</p>
            <button type="button" onClick={() => refetch()} className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 font-body text-sm">
              <ArrowsClockwise size={16} aria-hidden /> Réessayer
            </button>
          </div>
        ) : lots.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Package size={32} aria-hidden className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm">{EMPTY[filter]}</p>
            {filter === 'all' && (
              <p className="max-w-sm font-body text-sm text-[var(--color-text-secondary)]">
                Choisissez le suivi par lot ou par date limite dans la fiche d’un produit, puis réceptionnez son premier lot.
              </p>
            )}
            {filter === 'all' && canWrite && (
              <button type="button" onClick={() => setReceiving({})} className="h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-semibold text-[var(--color-on-accent)]">
                Réceptionner un lot
              </button>
            )}
          </div>
        ) : (
          <div role="table" aria-label="Lots en stock, du plus proche de sa date au plus lointain" className="px-4 pb-8 sm:px-6">
            <div role="row" className="sr-only md:not-sr-only md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] gap-4 border-b border-[var(--color-border-strong)] px-3 pb-2 font-body text-sm text-[var(--color-text-secondary)]">
              <span role="columnheader">Produit et lot</span>
              <span role="columnheader">Date limite</span>
              <span role="columnheader" className="text-right">Reste</span>
              <span role="columnheader">État</span>
              <span role="columnheader" className={canWrite ? '' : 'sr-only'}>Action</span>
            </div>
            <div role="rowgroup" className="space-y-2 md:space-y-0 md:divide-y md:divide-[var(--color-border)]">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  role="row"
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.3fr)] md:rounded-none md:border-0 md:bg-transparent md:py-3"
                >
                  <div role="cell" className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold">{lotTitle(lot)}</p>
                    <p className="truncate font-data text-xs text-[var(--color-text-secondary)]">
                      {lot.serialNumber ? `N° ${lot.serialNumber}` : lot.lotNumber ? `Lot ${lot.lotNumber}` : 'Sans numéro de lot'}
                      <span className="font-body"> · reçu le {formatDay(lot.receivedAt)}</span>
                    </p>
                  </div>
                  <div role="cell" className="row-start-2 font-body text-sm md:row-start-auto">
                    {lot.expiresAt ? (
                      <>
                        <span className="tabular">{formatDay(lot.expiresAt)}</span>
                        <span className="ml-1.5 text-xs text-[var(--color-text-secondary)]">{dateKindLabel(lot.dateKind)}</span>
                      </>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">Sans date</span>
                    )}
                  </div>
                  <div role="cell" className="col-start-2 row-start-1 text-right font-body text-sm md:col-start-auto md:row-start-auto">
                    <span className="tabular font-semibold">{quantityLabel(lot.quantity, lot.unit)}</span>
                    <span className="block text-xs text-[var(--color-text-secondary)] md:hidden">restant</span>
                  </div>
                  <div role="cell" className="col-start-2 row-start-2 flex flex-col items-end gap-0.5 md:col-start-auto md:row-start-auto md:items-start">
                    <LotBadge status={lot.status} daysLeft={lot.daysLeft} kind={lot.dateKind} />
                    {statusDetail(lot.status, lot.daysLeft) && <span className="font-body text-xs text-[var(--color-text-secondary)]">{statusDetail(lot.status, lot.daysLeft)}</span>}
                  </div>
                  <div role="cell" className="col-span-2 md:col-span-1">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setLosing(lot)}
                        aria-label={`Retirer de la vente, perte : ${lotTitle(lot)}, ${lot.lotNumber ? `lot ${lot.lotNumber}` : statusLabel(lot.status, lot.daysLeft, lot.dateKind)}`}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 font-body text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)] md:w-auto"
                      >
                        <Prohibit size={16} aria-hidden />
                        Retirer de la vente
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {canWrite && <ReceiveLotSheet siteId={siteId} open={!!receiving} productId={receiving?.productId} onClose={() => setReceiving(null)} />}
      {canWrite && <LossSheet siteId={siteId} lot={losing} onClose={() => setLosing(null)} />}
    </div>
  )
}
