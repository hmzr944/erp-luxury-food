'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretLeft, CaretRight, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { STATUS_LABEL, deliveryLabel, qty, supplyApi, untilLabel, type SupplyOrder } from '@/lib/api/supply'
import { QtyInput } from './QtyInput'
import { Loading } from '@/components/brand/FlowLogo'

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// L'écran du labo : ce qu'il faut produire pour un jour de livraison, toutes
// boutiques additionnées, puis la préparation colis par colis
export function LaboProduction({ siteId }: { siteId: string }) {
  const qc = useQueryClient()
  const [day, setDay] = useState<string | undefined>()
  const prod = useQuery({
    queryKey: ['supply', siteId, 'production', day],
    queryFn: () => supplyApi.production(siteId, day),
    refetchInterval: 30_000,
  })
  const [busy, setBusy] = useState(false)
  const p = prod.data
  if (!p) return prod.isError ? <p className="py-6 text-sm text-[var(--color-text-secondary)]">{(prod.error as Error).message}</p> : <Loading className="py-6" />

  const toStart = p.orders.filter((o) => o.status === 'SENT').length
  const until = untilLabel(p.cutoffAt, Date.now(), p.cutoffLocal)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Jour précédent" onClick={() => setDay(shift(p.day, -1))} className="grid size-11 place-items-center rounded-[var(--radius-pill)] hover:bg-[var(--color-bg-hover)]">
            <CaretLeft size={18} />
          </button>
          <h2 className="min-w-56 text-center text-lg font-semibold">Livraison {deliveryLabel(p.day).toLowerCase()}</h2>
          <button type="button" aria-label="Jour suivant" onClick={() => setDay(shift(p.day, 1))} className="grid size-11 place-items-center rounded-[var(--radius-pill)] hover:bg-[var(--color-bg-hover)]">
            <CaretRight size={18} />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">{until ? `Les boutiques peuvent encore modifier, clôture ${until}` : 'Commandes closes'}</p>
        {toStart > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await supplyApi.start(siteId, p.day)
                toast.success(`${r.started} ${r.started > 1 ? 'commandes passées' : 'commande passée'} en fabrication`)
                await qc.invalidateQueries({ queryKey: ['supply', siteId] })
              } catch (e) {
                toast.error((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
            className="ml-auto h-12 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-[15px] font-semibold text-[var(--color-on-accent)] disabled:opacity-60"
          >
            Lancer la fabrication
          </button>
        )}
      </div>

      {p.waitingFor.length > 0 && (
        <p className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px]">
          Aucune commande reçue de : <span className="font-semibold">{p.waitingFor.map((s) => s.name).join(', ')}</span>
        </p>
      )}

      <section aria-labelledby="totals-title">
        <h3 id="totals-title" className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          À produire, toutes boutiques
        </h3>
        {p.consolidated.length === 0 ? (
          <p className="py-6 text-[15px] text-[var(--color-text-secondary)]">Aucune commande pour ce jour.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
            {p.consolidated.map((c) => (
              <li key={`${c.productId}:${c.variantId}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <p className="tabular w-24 shrink-0 text-2xl font-semibold">
                  {qty(c.total)}
                  {c.unit && c.unit !== 'pièce' ? <span className="text-base font-medium"> {c.unit}</span> : null}
                </p>
                <p className="min-w-0 flex-1 text-[16px] font-medium">{c.variantName ? `${c.name}, ${c.variantName}` : c.name}</p>
                <p className="w-full text-sm text-[var(--color-text-secondary)] md:w-auto">
                  {c.bySite.map((b) => `${b.siteName} ${qty(b.quantity)}`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.orders.length > 0 && (
        <section aria-labelledby="packing-title" className="space-y-3">
          <h3 id="packing-title" className="text-sm font-semibold text-[var(--color-text-secondary)]">
            Préparation par boutique
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {p.orders.map((o) => (
              <PackingCard key={o.id} siteId={siteId} order={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PackingCard({ siteId, order }: { siteId: string; order: SupplyOrder }) {
  const qc = useQueryClient()
  const [prepared, setPrepared] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.id, l.prepared ?? l.ordered])))
  const [saving, setSaving] = useState(false)
  const shipped = order.status === 'SHIPPED' || order.status === 'RECEIVED'

  return (
    <article className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h4 className="text-[17px] font-semibold">{order.fromSite.name}</h4>
        <p className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)]">
          {shipped && <CheckCircle size={16} weight="fill" aria-hidden className="text-[var(--color-accent)]" />}
          n° {order.number}, {STATUS_LABEL[order.status].toLowerCase()}
        </p>
      </header>
      <ul className="divide-y divide-[var(--color-border)]">
        {order.lines.map((l) => {
          const label = l.variantName ? `${l.name}, ${l.variantName}` : l.name
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p className="text-[15px]">
                {label}
                <span className="block text-sm text-[var(--color-text-secondary)]">
                  Commandé {qty(l.ordered)}
                  {l.unit && l.unit !== 'pièce' ? ` ${l.unit}` : ''}
                  {l.received != null && l.received !== (l.prepared ?? l.ordered) ? `, reçu ${qty(l.received)}` : ''}
                  {l.issue ? `. ${l.issue}` : ''}
                </span>
              </p>
              {shipped ? (
                <p className="tabular text-[15px] font-semibold">{qty(l.prepared ?? l.ordered)} préparés</p>
              ) : (
                <QtyInput value={prepared[l.id] ?? 0} label={`Préparé, ${label}`} step={l.unit === 'kg' ? 0.5 : 1} onChange={(n) => setPrepared({ ...prepared, [l.id]: n })} />
              )}
            </li>
          )
        })}
      </ul>
      {order.note && <p className="text-sm text-[var(--color-text-secondary)]">Note : {order.note}</p>}
      {!shipped && (
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await supplyApi.ship(siteId, order.id, order.lines.map((l) => ({ lineId: l.id, prepared: prepared[l.id] ?? 0 })))
              toast.success(`Colis de ${order.fromSite.name} expédié`)
              await qc.invalidateQueries({ queryKey: ['supply', siteId] })
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setSaving(false)
            }
          }}
          className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-text-primary)] text-[15px] font-semibold text-[var(--color-bg-base)] disabled:opacity-60"
        >
          {saving ? 'Expédition...' : 'Colis prêt, expédier'}
        </button>
      )}
    </article>
  )
}
