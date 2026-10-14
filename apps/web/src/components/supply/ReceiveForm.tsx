'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Truck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { deliveryLabel, qty, supplyApi, type SupplyOrder } from '@/lib/api/supply'
import { QtyInput } from './QtyInput'

// Le camion est là : « Tout réceptionné » d'un geste, ou un écart à signaler.
// Le stock de la boutique est crédité de ce qui est réellement reçu.
export function ReceiveForm({ siteId, order, onDone }: { siteId: string; order: SupplyOrder; onDone?: () => void }) {
  const qc = useQueryClient()
  const [checking, setChecking] = useState(false)
  const [received, setReceived] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.id, l.prepared ?? l.ordered])),
  )
  const [issues, setIssues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async (all: boolean) => {
    setSaving(true)
    try {
      await supplyApi.receive(siteId, order.id, {
        lines: all
          ? []
          : order.lines.map((l) => ({ lineId: l.id, received: received[l.id] ?? 0, ...(issues[l.id]?.trim() ? { issue: issues[l.id].trim() } : {}) })),
      })
      toast.success('Livraison réceptionnée, stock mis à jour')
      await qc.invalidateQueries({ queryKey: ['supply', siteId] })
      onDone?.()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={`Livraison n° ${order.number}`} className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg-surface)] p-4">
      <p className="flex items-center gap-2 text-[17px] font-semibold">
        <Truck size={22} aria-hidden className="text-[var(--color-accent)]" />
        Livraison de {order.toSite.name} arrivée
      </p>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Commande n° {order.number}, pour {deliveryLabel(order.deliveryDay).toLowerCase()}
      </p>
      {order.shortages.length > 0 && (
        <ul className="space-y-1 rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px] font-medium" role="status">
          {order.shortages.map((s) => (
            <li key={s.name}>
              Ajustement du labo, {s.name} : {qty(s.prepared)} livrés au lieu de {qty(s.ordered)}
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {order.lines.map((l) => {
          const sent = l.prepared ?? l.ordered
          const label = l.variantName ? `${l.name}, ${l.variantName}` : l.name
          return (
            <li key={l.id} className="space-y-2 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px]">
                  <span className="tabular font-semibold">{qty(sent)}</span> {label}
                  {l.unit ? <span className="text-[var(--color-text-secondary)]"> ({l.unit})</span> : null}
                </p>
                {checking && <QtyInput value={received[l.id] ?? 0} label={`Reçu, ${label}`} step={l.unit === 'kg' ? 0.5 : 1} onChange={(n) => setReceived({ ...received, [l.id]: n })} />}
              </div>
              {checking && (received[l.id] ?? 0) < sent && (
                <input
                  aria-label={`Problème sur ${label}`}
                  placeholder="Ce qui ne va pas, par exemple « 2 abîmées pendant le transport »"
                  value={issues[l.id] ?? ''}
                  onChange={(e) => setIssues({ ...issues, [l.id]: e.target.value })}
                  className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)] focus:outline-none"
                />
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        {checking ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(false)}
            className="h-14 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Valider la réception'}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => submit(true)}
              className="h-14 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-60 press"
            >
              {saving ? 'Enregistrement...' : 'Tout réceptionné'}
            </button>
            <button
              type="button"
              onClick={() => setChecking(true)}
              className="h-14 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 text-[15px] font-semibold"
            >
              Signaler un problème
            </button>
          </>
        )}
      </div>
    </section>
  )
}
