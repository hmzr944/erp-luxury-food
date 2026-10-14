'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Clock } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { formatPrice } from '@erp/utils'
import { STATUS_LABEL, deliveryLabel, qty, supplyApi, untilLabel, type DraftLine } from '@/lib/api/supply'
import { QtyInput } from './QtyInput'
import { Loading } from '@/components/brand/FlowLogo'

const key = (l: { productId: string; variantId: string | null }) => `${l.productId}:${l.variantId ?? ''}`

// Bon de commande de la boutique : pré-rempli à partir des ventes, ajusté au
// pouce, envoyé d'un geste. Modifiable jusqu'à l'heure de clôture du labo.
export function ShopOrderForm({ siteId, onSent, surface }: { siteId: string; onSent?: () => void; surface?: boolean }) {
  const qc = useQueryClient()
  const suppliers = useQuery({ queryKey: ['supply', siteId, 'suppliers'], queryFn: () => supplyApi.suppliers(siteId) })
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const active = supplierId ?? suppliers.data?.find((s) => s.products > 0)?.id ?? null
  const draft = useQuery({
    queryKey: ['supply', siteId, 'draft', active],
    queryFn: () => supplyApi.draft(siteId, active!),
    enabled: !!active,
  })
  const [values, setValues] = useState<Record<string, number>>({})
  const [sending, setSending] = useState(false)
  const now = useNow()

  useEffect(() => {
    if (draft.data) setValues(Object.fromEntries(draft.data.lines.map((l) => [key(l), l.ordered])))
  }, [draft.data])

  const groups = useMemo(() => {
    const g = new Map<string, DraftLine[]>()
    for (const l of draft.data?.lines ?? []) {
      const c = l.category ?? 'Autres'
      g.set(c, [...(g.get(c) ?? []), l])
    }
    return [...g.entries()]
  }, [draft.data])

  if (suppliers.isLoading) return <Loading className="py-6" />
  if (!suppliers.data?.length) {
    return (
      <p className="py-6 text-[15px] text-[var(--color-text-secondary)]">
        Aucun labo ni dépôt dans votre organisation. Déclarez-en un dans l&apos;onglet Réglages.
      </p>
    )
  }
  if (!draft.data) return draft.isError ? <p className="py-6 text-sm text-[var(--color-text-secondary)]">{(draft.error as Error).message}</p> : <Loading className="py-6" />

  const d = draft.data
  const until = untilLabel(d.cutoffAt, now, d.cutoffLocal)
  const order = d.order
  const total = d.lines.reduce((a, l) => a + (l.unitPrice ?? 0) * (values[key(l)] ?? 0), 0)
  const count = d.lines.filter((l) => (values[key(l)] ?? 0) > 0).length
  const changed = order ? d.lines.some((l) => (values[key(l)] ?? 0) !== l.ordered) : true

  const send = async () => {
    setSending(true)
    try {
      await supplyApi.save(siteId, {
        supplierId: d.supplier.id,
        deliveryDay: d.deliveryDay,
        send: true,
        lines: d.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: values[key(l)] ?? 0, suggested: l.suggested })),
      })
      toast.success(order ? 'Commande mise à jour' : `Commande envoyée à ${d.supplier.name}`)
      await qc.invalidateQueries({ queryKey: ['supply', siteId] })
      onSent?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {suppliers.data.length > 1 && (
        <div role="radiogroup" aria-label="Fournisseur" className="flex flex-wrap gap-2">
          {suppliers.data.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === active}
              onClick={() => setSupplierId(s.id)}
              className={[
                'h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium',
                s.id === active ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            Livraison {deliveryLabel(d.deliveryDay).toLowerCase()}
            <span className="font-normal text-[var(--color-text-secondary)]">, par {d.supplier.name}</span>
          </p>
          {order && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
              <CheckCircle size={16} weight="fill" aria-hidden />
              Commande n° {order.number} {STATUS_LABEL[order.status].toLowerCase()}
              {order.sentAt ? ` à ${new Date(order.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
          )}
        </div>
        <p
          className={[
            'flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-medium',
            d.editable && until ? 'bg-[var(--color-accent-muted)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]',
          ].join(' ')}
          aria-live="polite"
        >
          <Clock size={16} aria-hidden />
          {d.editable && until ? `Clôture ${until}` : 'Commande close'}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-[15px] text-[var(--color-text-secondary)]">{d.supplier.name} ne propose encore aucun produit aux boutiques.</p>
      ) : (
        groups.map(([cat, lines]) => (
          <section key={cat} aria-label={cat}>
            {groups.length > 1 && <h3 className="mb-1 text-sm font-semibold text-[var(--color-text-secondary)]">{cat}</h3>}
            <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {lines.map((l) => {
                const v = values[key(l)] ?? 0
                const label = l.variantName ? `${l.name}, ${l.variantName}` : l.name
                return (
                  <li key={key(l)} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-[15px] font-medium">
                        {label}
                        {l.unit ? <span className="font-normal text-[var(--color-text-secondary)]"> ({l.unit})</span> : null}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {l.suggested > 0 && v !== l.suggested ? `Suggéré ${qty(l.suggested)}. ` : ''}
                        {l.reason}
                      </p>
                    </div>
                    <QtyInput value={v} label={label} step={l.unit === 'kg' ? 0.5 : 1} disabled={!d.editable} onChange={(n) => setValues({ ...values, [key(l)]: n })} />
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      {d.editable && groups.length > 0 && (
        <div className={`sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 px-1 py-3 ${surface ? 'bg-[var(--color-bg-surface)]' : 'bg-[var(--color-bg-base)]'}`}>
          <p className="tabular text-[15px] text-[var(--color-text-secondary)]">
            {count} {count > 1 ? 'produits' : 'produit'}
            {total > 0 ? `, ${formatPrice(total)} en cession` : ''}
          </p>
          <button
            type="button"
            disabled={sending || !count || !changed}
            onClick={send}
            className="ml-auto h-14 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-6 text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press"
          >
            {sending ? 'Envoi...' : order ? (changed ? 'Mettre à jour la commande' : 'Commande à jour') : 'Envoyer la commande'}
          </button>
        </div>
      )}
    </div>
  )
}

// Rafraîchit le compte à rebours de la clôture
function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), every)
    return () => window.clearInterval(id)
  }, [every])
  return now
}
