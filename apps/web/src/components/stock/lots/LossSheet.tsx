'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sheet } from '@/components/pos/Sheet'
import { FieldError } from '@/components/ui/FieldError'
import { lotsApi, type LotRow } from '@/lib/api/lots'
import { REASONS, dateKindLabel, formatDay, lotTitle, quantityLabel } from './lots-view'

const field = 'w-full h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]'

// Retrait d'un lot de la vente : la quantité sort du stock et une perte est notée avec son motif
export function LossSheet({ siteId, lot, onClose }: { siteId: string; lot: LotRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [all, setAll] = useState(true)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (lot) {
      setAll(true)
      setQty('')
      setReason(lot.status === 'EXPIRED' ? 'Périmé' : '')
      setTried(false)
    }
  }, [lot])

  const quantity = all ? lot?.quantity : Number(qty.replace(',', '.'))
  const quantityError = !lot || all ? null : !quantity || quantity <= 0 ? 'Indiquez une quantité' : quantity > lot.quantity ? `Le lot ne contient que ${quantityLabel(lot.quantity, lot.unit)}` : null
  const reasonError = reason.trim().length < 3 ? 'Le motif est obligatoire' : null

  const mutation = useMutation({
    mutationFn: () => lotsApi.loss(siteId, lot!.id, { quantity: all ? undefined : quantity, reason: reason.trim() }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['lots', siteId] })
      qc.invalidateQueries({ queryKey: ['lots-expired-only', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-inventory', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-movements', siteId] })
      toast.success(`${quantityLabel(r.quantity, lot!.unit)} retiré${r.quantity > 1 ? 's' : ''} de la vente`)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Retrait impossible'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (quantityError || reasonError) return
    mutation.mutate()
  }

  return (
    <Sheet open={!!lot} title="Retirer de la vente (perte)" onClose={onClose} locked={mutation.isPending}>
      {lot && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
            <p className="font-body text-sm font-semibold">{lotTitle(lot)}</p>
            <p className="font-body text-sm text-[var(--color-text-secondary)]">
              {lot.lotNumber ? `Lot ${lot.lotNumber} · ` : ''}
              {lot.expiresAt ? `${dateKindLabel(lot.dateKind)} ${formatDay(lot.expiresAt)} · ` : ''}
              reste {quantityLabel(lot.quantity, lot.unit)}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="font-body text-sm font-medium">Quantité retirée</legend>
            <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-1">
              {([[true, 'Tout le lot'], [false, 'Une partie']] as const).map(([value, label]) => (
                <label key={label} className={`flex h-10 cursor-pointer items-center justify-center rounded-[calc(var(--radius-md)-4px)] text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)] ${all === value ? 'bg-[var(--color-bg-inverse)] font-semibold text-[var(--color-text-inverse)]' : 'text-[var(--color-text-secondary)]'}`}>
                  <input type="radio" name="loss-all" checked={all === value} onChange={() => setAll(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            {!all && (
              <div className="space-y-1.5">
                <label htmlFor="loss-qty" className="sr-only">Quantité à retirer</label>
                <input id="loss-qty" inputMode="decimal" autoComplete="off" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={tried && !!quantityError} aria-describedby={tried && quantityError ? 'loss-qty-err' : undefined} className={field + ' tabular'} placeholder={`Sur ${quantityLabel(lot.quantity, lot.unit)}`} />
                {tried && quantityError && <FieldError id="loss-qty-err">{quantityError}</FieldError>}
              </div>
            )}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="loss-reason" className="font-body text-sm font-medium">Motif *</label>
            <input id="loss-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoComplete="off" aria-required="true" aria-invalid={tried && !!reasonError} aria-describedby={tried && reasonError ? 'loss-reason-err' : undefined} className={field} placeholder="Pourquoi ce retrait ?" />
            {tried && reasonError && <FieldError id="loss-reason-err">{reasonError}</FieldError>}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Motifs courants">
              {REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`h-10 rounded-[var(--radius-pill)] border px-3 text-sm ${reason === r ? 'border-[var(--color-accent)] font-semibold' : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)]'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <p className="font-body text-sm text-[var(--color-text-secondary)]">
            Le stock du produit baisse d’autant et une perte liée à ce lot est notée dans les mouvements, avec le motif.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] font-body text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] font-body text-sm font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60">
              {mutation.isPending ? 'Retrait…' : 'Retirer de la vente'}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
