'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CORRECTION_REASONS, stockApi, type CorrectionReason, type StockItemApi } from '@/lib/api/stock'
import { FieldError } from '@/components/ui/FieldError'
import { Sheet } from './Sheet'
import { formatGap, formatQty, gapOf, itemLabel, parseQty } from './stock-format'

export type StockAction = 'receive' | 'correct' | 'loss'

const LOSS_REASONS = ['Casse', 'Périmé', 'Vol', 'Don', 'Autre'] as const

const inputCls =
  'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 font-body text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]'

const chipCls =
  'relative flex min-h-11 cursor-pointer items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 font-body text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)] has-[:checked]:font-semibold has-[:checked]:text-[var(--color-text-primary)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]'

const TEXT: Record<StockAction, { title: string; qty: string; submit: string }> = {
  receive: { title: 'Réceptionner', qty: 'Quantité reçue', submit: 'Enregistrer la réception' },
  correct: { title: 'Corriger le stock', qty: 'Quantité réellement comptée', submit: 'Corriger le stock' },
  loss: { title: 'Déclarer une perte', qty: 'Quantité perdue', submit: 'Enregistrer la perte' },
}

// Feuille de saisie d'un mouvement : réception, correction ou perte
export function StockActionSheet({
  siteId,
  item,
  action,
  onClose,
}: {
  siteId: string
  item: StockItemApi
  action: StockAction
  onClose: () => void
}) {
  const qc = useQueryClient()
  const current = Number(item.quantity)
  const [qty, setQty] = useState(action === 'correct' ? String(current).replace('.', ',') : '')
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const value = parseQty(qty)
  const text = TEXT[action]
  const after =
    value === null ? null : action === 'receive' ? current + value : action === 'loss' ? current - value : value
  const gap = action === 'correct' && value !== null ? gapOf(value, current) : null

  const save = useMutation({
    mutationFn: async () => {
      if (value === null) throw new Error('Saisissez une quantité (nombre positif, 3 décimales au plus)')
      const variantId = item.variantId ?? undefined
      if (action === 'receive') {
        if (value <= 0) throw new Error('La quantité reçue doit être supérieure à zéro')
        await stockApi.addMovement(siteId, { productId: item.productId, variantId, type: 'RESTOCK', quantity: value, reason: note.trim() || undefined })
        return `Réception enregistrée : ${formatQty(current)} vers ${formatQty(current + value)}`
      }
      if (action === 'loss') {
        if (value <= 0) throw new Error('La quantité perdue doit être supérieure à zéro')
        if (value > current) throw new Error(`Une perte ne peut pas dépasser le stock (${formatQty(current)}). Corrigez d'abord le stock.`)
        if (!reason) throw new Error('Choisissez un motif')
        await stockApi.addMovement(siteId, {
          productId: item.productId, variantId, type: 'LOSS', quantity: value,
          reason: note.trim() ? `${reason} : ${note.trim()}` : reason,
        })
        return `Perte enregistrée : ${formatQty(current)} vers ${formatQty(current - value)}`
      }
      if (!reason) throw new Error('Choisissez un motif')
      if (reason === 'AUTRE' && !note.trim()) throw new Error('Précisez le motif de la correction')
      if (gapOf(value, current) === 0) throw new Error('La quantité comptée est déjà celle du stock')
      await stockApi.correct(siteId, {
        productId: item.productId, variantId, countedQuantity: value, reasonCode: reason as CorrectionReason, note: note.trim() || undefined,
      })
      return `Stock corrigé : ${formatQty(current)} vers ${formatQty(value)}`
    },
    onSuccess: (message) => {
      qc.invalidateQueries({ queryKey: ['stock-inventory', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-movements', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-alerts', siteId] })
      toast.success(message)
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Sheet
      title={text.title}
      description={`${itemLabel(item)}. En stock : ${formatQty(current)} ${item.unit}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] font-body text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="stock-action-form"
            disabled={save.isPending}
            className="h-11 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] font-body text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {save.isPending ? 'Enregistrement…' : text.submit}
          </button>
        </>
      }
    >
      <form
        id="stock-action-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          save.mutate()
        }}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label htmlFor="sa-qty" className="font-body text-sm font-medium text-[var(--color-text-primary)]">{text.qty}</label>
          <div className="flex items-center gap-2">
            <input
              id="sa-qty"
              data-autofocus
              inputMode="decimal"
              autoComplete="off"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputCls} tabular`}
              placeholder="0"
              aria-describedby="sa-preview"
            />
            <span className="w-16 shrink-0 font-body text-sm text-[var(--color-text-secondary)]" aria-label={`Unité : ${item.unit}`}>{item.unit}</span>
          </div>
          <p id="sa-preview" aria-live="polite" className="tabular font-body text-sm text-[var(--color-text-secondary)]">
            {action === 'correct' && gap !== null && (
              <>Écart : <strong className="font-semibold text-[var(--color-text-primary)]">{formatGap(gap)} {item.unit}</strong>. </>
            )}
            {after !== null && <>Stock après : {formatQty(current)} vers {formatQty(after)} {item.unit}</>}
          </p>
        </div>

        {action !== 'receive' && (
          <fieldset className="space-y-2">
            <legend className="font-body text-sm font-medium text-[var(--color-text-primary)]">Motif</legend>
            <div className="flex flex-wrap gap-2">
              {action === 'correct'
                ? CORRECTION_REASONS.map((r) => (
                    <label key={r.code} className={chipCls}>
                      <input type="radio" name="sa-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} className="sr-only" />
                      {r.label}
                    </label>
                  ))
                : LOSS_REASONS.map((r) => (
                    <label key={r} className={chipCls}>
                      <input type="radio" name="sa-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
                      {r}
                    </label>
                  ))}
            </div>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <label htmlFor="sa-note" className="font-body text-sm font-medium text-[var(--color-text-primary)]">
            {action === 'receive' ? 'Référence (facultatif)' : action === 'correct' && reason === 'AUTRE' ? 'Précision (obligatoire)' : 'Précision (facultatif)'}
          </label>
          <input
            id="sa-note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            autoComplete="off"
            className={inputCls}
            placeholder={action === 'receive' ? 'Bon de livraison, fournisseur' : 'Ce qui s’est passé'}
          />
        </div>

        {error && <FieldError>{error}</FieldError>}
      </form>
    </Sheet>
  )
}
