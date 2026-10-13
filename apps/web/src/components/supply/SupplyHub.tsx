'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSiteStore } from '@/stores/site.store'
import { sitesApi } from '@/lib/api/sites'
import { STATUS_LABEL, deliveryLabel, supplyApi } from '@/lib/api/supply'
import { formatPrice } from '@erp/utils'
import { ShopOrderForm } from './ShopOrderForm'
import { ReceiveForm } from './ReceiveForm'
import { LaboProduction } from './LaboProduction'
import { LaboCatalog } from './LaboCatalog'
import { LaboStatement } from './LaboStatement'
import { SupplySetup } from './SupplySetup'

type Tab = { key: string; label: string }

// Approvisionnement interne. La même page sert la boutique (commander,
// réceptionner) et le labo ou dépôt (produire, préparer, facturer en interne).
export function SupplyHub() {
  const { currentSite } = useSiteStore()
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll })
  const site = sites.data?.find((s) => s.id === currentSite?.id)
  const labo = !!site?.isSupplier
  const tabs: Tab[] = labo
    ? [
        { key: 'production', label: 'Production' },
        { key: 'offre', label: 'Offre aux boutiques' },
        { key: 'cessions', label: 'Cessions' },
        { key: 'reglages', label: 'Réglages' },
      ]
    : [
        { key: 'commande', label: 'Commander' },
        { key: 'historique', label: 'Historique' },
        { key: 'reglages', label: 'Réglages' },
      ]
  const [tab, setTab] = useState(tabs[0].key)
  useEffect(() => setTab(tabs[0].key), [labo]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentSite || !site) return <div className="p-8 text-sm text-[var(--color-text-secondary)]">Chargement...</div>

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 md:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Approvisionnement</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{labo ? `${site.name}, labo ou dépôt` : `${site.name} commande à son labo ou dépôt`}</p>
        </div>
        <div role="tablist" aria-label="Affichage" className="flex flex-wrap rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={[
                'h-10 rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors duration-150',
                tab === t.key ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6">
          {tab === 'production' && <LaboProduction siteId={site.id} />}
          {tab === 'offre' && <LaboCatalog siteId={site.id} />}
          {tab === 'cessions' && <LaboStatement siteId={site.id} />}
          {tab === 'commande' && <ShopSide siteId={site.id} />}
          {tab === 'historique' && <ShopHistory siteId={site.id} />}
          {tab === 'reglages' && <SupplySetup />}
        </div>
      </div>
    </div>
  )
}

export function ShopSide({ siteId, onChange, surface }: { siteId: string; onChange?: () => void; surface?: boolean }) {
  const inbox = useQuery({ queryKey: ['supply', siteId, 'inbox'], queryFn: () => supplyApi.inbox(siteId), refetchInterval: 60_000 })
  return (
    <div className="space-y-6">
      {inbox.data?.toReceive.map((o) => <ReceiveForm key={o.id} siteId={siteId} order={o} onDone={onChange} />)}
      <ShopOrderForm siteId={siteId} onSent={onChange} surface={surface} />
    </div>
  )
}

function ShopHistory({ siteId }: { siteId: string }) {
  const orders = useQuery({ queryKey: ['supply', siteId, 'outgoing'], queryFn: () => supplyApi.outgoing(siteId) })
  if (!orders.data) return <p className="py-6 text-sm text-[var(--color-text-secondary)]">Chargement...</p>
  if (!orders.data.length) return <p className="py-6 text-[15px] text-[var(--color-text-secondary)]">Aucune commande pour l&apos;instant.</p>
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {orders.data.map((o) => (
        <li key={o.id} className="px-4 py-3">
          <p className="flex flex-wrap justify-between gap-2 text-[15px] font-medium">
            <span>
              {deliveryLabel(o.deliveryDay)}, {o.toSite.name}
            </span>
            <span className="text-[var(--color-text-secondary)]">
              n° {o.number}, {STATUS_LABEL[o.status].toLowerCase()}
              {o.amount ? `, ${formatPrice(o.amount)}` : ''}
            </span>
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {o.lines.map((l) => `${l.received ?? l.prepared ?? l.ordered} ${l.name}`).join(', ')}
          </p>
          {o.lines.some((l) => l.issue) && (
            <p className="text-sm font-medium text-[var(--color-accent)]">{o.lines.filter((l) => l.issue).map((l) => `${l.name} : ${l.issue}`).join(', ')}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
