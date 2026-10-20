'use client'

import { useEffect, useId, useState } from 'react'
import { DISCOUNT_REASONS, SELLER_DISCOUNT_MAX_PERCENT, discountCents, discountPercent, formatPrice, type DiscountReasonCode, type DiscountSpec } from '@erp/utils'
import { useAuthStore } from '@/stores/auth.store'
import { discountExcess, lineGrossCents, ticketDiscountRoom, useCartStore, type CartLine } from '@/stores/cart.store'
import { Sheet } from './Sheet'

// Ligne à remiser, ou le ticket entier
export type DiscountTarget = { kind: 'line'; key: string } | { kind: 'ticket' }

const QUICK_PERCENTS = [5, 10, 15, 20]

const fieldCls =
  'h-14 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-4 pr-14 text-2xl font-semibold tabular focus:border-[var(--color-accent)]'

const parseValue = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

const chip = (active: boolean) =>
  [
    'inline-flex h-11 items-center justify-center rounded-[var(--radius-pill)] px-4 text-sm font-medium',
    active ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]',
  ].join(' ')

// Remise manuelle d'une ligne ou du ticket : pourcentage ou montant, aperçu du
// nouveau prix, motif facultatif. Le calcul est celui de la caisse et du serveur.
export function DiscountSheet({ target, onClose }: { target: DiscountTarget | null; onClose: () => void }) {
  const { lines, ticketDiscount, loyalty, setLineDiscountSpec, setTicketDiscount } = useCartStore()
  const role = useAuthStore((s) => s.user?.role)
  const id = useId()
  const line: CartLine | undefined = target?.kind === 'line' ? lines.find((l) => l.key === target.key) : undefined
  const current = target?.kind === 'ticket' ? ticketDiscount : line?.discountSpec ?? null

  const [mode, setMode] = useState<DiscountSpec['mode']>('percent')
  const [text, setText] = useState('')
  const [reason, setReason] = useState<DiscountReasonCode | undefined>()

  // Ouverture : on reprend la remise en cours, sinon un formulaire vide
  const open = !!target
  useEffect(() => {
    if (!open) return
    setMode(current?.mode ?? 'percent')
    setText(current ? String(current.value).replace('.', ',') : '')
    setReason(current?.reason)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.kind, line?.key])

  const isTicket = target?.kind === 'ticket'
  // Base de la remise : prix de la ligne, ou ce qui reste remisable sur le ticket (cartes cadeaux exclues)
  const baseCents = isTicket ? Math.round(ticketDiscountRoom(lines) * 100) : line ? lineGrossCents(line) : 0
  const value = parseValue(text)
  const spec: DiscountSpec | null = value > 0 ? { mode, value, ...(reason ? { reason } : {}) } : null
  const cents = spec ? discountCents(spec, baseCents) : 0
  const capped = !!spec && (mode === 'amount' ? Math.round(value * 100) > baseCents : value > 100)

  // Un vendeur ne remise pas seul au-delà de la limite (remises de ligne et de ticket cumulées)
  const excess = spec && cents > 0 ? discountExcess(isTicket ? lines : lines.map((l) => (l.key === line?.key ? { ...l, discount: cents / 100 } : l)), isTicket ? spec : ticketDiscount, role) : []
  const blocked = excess.length > 0

  // La récompense fidélité et une remise manuelle ne se cumulent pas
  const loyaltyUsed = !!loyalty
  const nothingToDiscount = baseCents === 0

  const apply = () => {
    if (!spec || cents === 0 || blocked || loyaltyUsed) return
    if (isTicket) setTicketDiscount(spec)
    else if (line) setLineDiscountSpec(line.key, spec)
    onClose()
  }
  const remove = () => {
    if (isTicket) setTicketDiscount(null)
    else if (line) setLineDiscountSpec(line.key, null)
    onClose()
  }

  const title = isTicket ? 'Remise sur le ticket' : 'Remise sur la ligne'
  const subject = isTicket ? 'Articles remisables' : line ? (line.customName ?? line.product.name) : ''

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        {loyaltyUsed ? (
          <p role="status" className="rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] p-3 text-sm">
            Une récompense fidélité est utilisée sur cette vente. Retirez-la (« Garder les points pour plus tard ») pour remiser à la main : les deux ne se cumulent pas.
          </p>
        ) : nothingToDiscount ? (
          <p role="status" className="rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] p-3 text-sm">
            Rien à remiser : une carte cadeau ou un avoir ne se remise jamais.
          </p>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="sr-only">Type de remise</legend>
              <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] p-1">
                {([['percent', 'Pourcentage'], ['amount', 'Montant en euros']] as const).map(([m, label]) => (
                  <label key={m} className="relative">
                    <input type="radio" name={`${id}-mode`} value={m} checked={mode === m} onChange={() => setMode(m)} className="peer sr-only" />
                    <span className="flex h-11 cursor-pointer items-center justify-center rounded-[var(--radius-pill)] text-sm font-medium peer-checked:bg-[var(--color-bg-inverse)] peer-checked:text-[var(--color-text-inverse)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--color-accent)]">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor={`${id}-value`} className="block text-sm font-medium">
                {mode === 'percent' ? 'Pourcentage de remise' : 'Montant de la remise'}
              </label>
              <div className="relative">
                <input
                  id={`${id}-value`}
                  data-autofocus
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-describedby={`${id}-preview`}
                  className={fieldCls}
                />
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-xl text-[var(--color-text-secondary)]">
                  {mode === 'percent' ? '%' : '€'}
                </span>
              </div>
              {mode === 'percent' && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_PERCENTS.map((p) => (
                    <button key={p} type="button" aria-pressed={value === p} onClick={() => setText(String(p))} className={chip(value === p)}>
                      {p} %
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div id={`${id}-preview`} aria-live="polite" className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm">
              <p className="truncate text-[var(--color-text-secondary)]">{subject}</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <s className="tabular text-[var(--color-text-secondary)]">{formatPrice(baseCents / 100)}</s>
                <span className="tabular text-2xl font-semibold">{formatPrice((baseCents - cents) / 100)}</span>
                {cents > 0 && (
                  <span className="tabular text-[var(--color-text-secondary)]">
                    remise {formatPrice(cents / 100)} ({String(discountPercent(cents / 100, baseCents / 100)).replace('.', ',')} %)
                  </span>
                )}
              </p>
              {capped && <p className="mt-1">{mode === 'percent' ? 'Remise plafonnée à 100 %.' : 'Remise plafonnée au prix : le total ne devient jamais négatif.'}</p>}
            </div>

            {blocked && (
              <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] p-3 text-sm">
                <strong className="font-semibold">Demandez à un responsable de passer cette remise.</strong> Un vendeur remise jusqu’à {SELLER_DISCOUNT_MAX_PERCENT} % d’une ligne ; ici {excess.map((e) => `${e.name} : ${String(e.percent).replace('.', ',')} %`).join(', ')}.
              </p>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Motif (facultatif)</legend>
              <div className="flex flex-wrap gap-2">
                {DISCOUNT_REASONS.map((r) => (
                  <button key={r.code} type="button" aria-pressed={reason === r.code} onClick={() => setReason(reason === r.code ? undefined : r.code)} className={chip(reason === r.code)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="space-y-2">
          {!loyaltyUsed && !nothingToDiscount && (
            <button
              type="submit"
              disabled={!spec || cents === 0 || blocked}
              className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press"
            >
              {cents > 0 && !blocked ? `Appliquer ${formatPrice(cents / 100)} de remise` : 'Appliquer la remise'}
            </button>
          )}
          {current && (
            <button type="button" onClick={remove} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-base font-medium hover:bg-[var(--color-bg-hover)]">
              Supprimer la remise
            </button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
