'use client'

import { useState } from 'react'
import { useSiteStore } from '@/stores/site.store'
import { OrdersHub } from './OrdersHub'
import { OrdersHistory } from './OrdersHistory'

type View = 'history' | 'board'

export function OrdersHubWithSite() {
  const { currentSite } = useSiteStore()
  const [view, setView] = useState<View>('history')

  if (!currentSite) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Sélectionnez un site dans la barre latérale</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 md:px-6">
        <h1 className="page-title">Commandes</h1>
        <div role="group" aria-label="Affichage" className="flex rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] p-0.5">
          {(
            [
              ['history', 'Historique et retours'],
              ['board', 'À préparer'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={[
                'h-10 rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors duration-150',
                view === key ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'history' ? <OrdersHistory siteId={currentSite.id} /> : <OrdersHub siteId={currentSite.id} />}
      </div>
    </div>
  )
}
