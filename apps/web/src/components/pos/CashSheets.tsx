'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { CASH_DIFFERENCE_REASONS, EURO_DENOMINATIONS, closingPlan, countCash, formatPrice } from '@erp/utils'
import { cashApi, type CashSession } from '@/lib/api/cash'
import { ApiError } from '@/lib/api/client'
import { QtyInput } from '@/components/supply/QtyInput'
import { Sheet } from './Sheet'

const parseAmount = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function useCashState(siteId: string, terminalId: string | undefined, online: boolean) {
  return useQuery({
    queryKey: ['cash', siteId, terminalId],
    queryFn: () => cashApi.current(siteId, terminalId!),
    enabled: !!terminalId && online,
    staleTime: 60_000,
    retry: false,
  })
}

// Ouverture : le fond laissé hier, confirmé d'un geste. Un écart ? « Ajuster ».
export function CashOpenSheet({ siteId, terminalId, open, onClose }: { siteId: string; terminalId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const state = useCashState(siteId, terminalId, true)
  const [adjusting, setAdjusting] = useState(false)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const suggested = state.data?.suggestedOpening ?? 0

  const confirm = async (value: number) => {
    setSaving(true)
    try {
      await cashApi.open(siteId, { terminalId, amount: value })
      await qc.invalidateQueries({ queryKey: ['cash', siteId, terminalId] })
      toast.success(`Caisse ouverte avec ${formatPrice(value)}`)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const typed = parseAmount(amount)
  return (
    <Sheet open={open} title="Ouverture de la caisse" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-[15px] text-[var(--color-text-secondary)]">
          {state.data?.lastClosedAt ? 'Fond laissé dans le tiroir à la dernière fermeture' : 'Fond de caisse habituel'}
        </p>
        <p className="tabular text-5xl font-semibold tracking-tight">{formatPrice(suggested)}</p>
        {adjusting ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed != null) void confirm(typed)
            }}
          >
            <label htmlFor="opening" className="block text-sm font-medium">
              Montant réellement dans le tiroir
            </label>
            <input
              id="opening"
              data-autofocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="tabular h-16 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-3xl font-semibold focus:border-[var(--color-accent)] focus:outline-none"
            />
            <button type="submit" disabled={typed == null || saving} className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:opacity-50">
              {typed != null ? `Ouvrir avec ${formatPrice(typed)}` : 'Ouvrir'}
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              data-autofocus
              disabled={saving || !state.data}
              onClick={() => confirm(suggested)}
              className="h-14 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              Confirmer {formatPrice(suggested)}
            </button>
            <button type="button" onClick={() => setAdjusting(true)} className="h-14 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 text-[15px] font-semibold">
              Ajuster
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

const BILLS = EURO_DENOMINATIONS.filter((d) => d.cents >= 500 && d.cents <= 10000)
const COINS = EURO_DENOMINATIONS.filter((d) => d.cents < 500)

// Fermeture : on compte des billets et des pièces, la caisse fait les
// multiplications. L'écart n'apparaît qu'une fois le comptage validé.
export function CashCloseSheet({
  siteId,
  terminalId,
  open,
  pendingSales,
  onClose,
}: {
  siteId: string
  terminalId: string
  open: boolean
  pendingSales: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const state = useCashState(siteId, terminalId, true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [needsReason, setNeedsReason] = useState<number | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<CashSession | null>(null)

  useEffect(() => {
    if (open) {
      setCounts({})
      setNeedsReason(null)
      setReason(null)
      setDone(null)
    }
  }, [open])

  const counted = useMemo(() => countCash(Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0))) / 100, [counts])
  const target = state.data?.floatTarget ?? 0
  const preview = closingPlan({ counted: Math.round(counted * 100), expected: 0, floatTarget: Math.round(target * 100), tolerance: 0 })

  const submit = async () => {
    setSaving(true)
    try {
      const r = await cashApi.close(siteId, {
        terminalId,
        denominations: Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)),
        ...(reason ? { reason } : {}),
      })
      setDone(r)
      await qc.invalidateQueries({ queryKey: ['cash', siteId, terminalId] })
    } catch (e) {
      if (e instanceof ApiError && e.body.needsReason) setNeedsReason(Number(e.body.difference))
      else toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const row = (d: (typeof EURO_DENOMINATIONS)[number]) => {
    const n = counts[String(d.cents)] ?? 0
    return (
      <li key={d.cents} className="flex items-center justify-between gap-3 py-2">
        <span className="tabular w-16 shrink-0 whitespace-nowrap text-[17px] font-semibold">{d.label}</span>
        <QtyInput value={n} label={`Nombre de ${d.kind}s de ${d.label}`} onChange={(v) => setCounts({ ...counts, [d.cents]: Math.round(v) })} disabled={!!done || needsReason != null} />
        <span className="tabular w-24 text-right text-[15px] text-[var(--color-text-secondary)]">{n ? formatPrice((n * d.cents) / 100) : ''}</span>
      </li>
    )
  }

  return (
    <Sheet open={open} title={done ? 'Caisse fermée' : 'Fermeture de la caisse'} onClose={onClose} width="lg" locked={saving}>
      {done ? (
        <div className="space-y-5 pb-1">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle size={26} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
            {formatPrice(done.counted ?? 0)} comptés
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Gardez dans le tiroir pour demain</p>
              <p className="tabular text-3xl font-semibold">{formatPrice(done.keptFloat ?? 0)}</p>
            </div>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-accent)] p-4 text-[var(--color-on-accent)]">
              <p className="text-sm opacity-90">Déposez dans l&apos;enveloppe banque</p>
              <p className="tabular text-3xl font-semibold">{formatPrice(done.deposit ?? 0)}</p>
            </div>
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)]">
            {!done.difference
              ? 'Le compte est juste.'
              : `${formatPrice(Math.abs(done.difference))} ${done.difference > 0 ? 'de plus' : 'de moins'} que prévu${done.differenceReason ? `, motif : ${done.differenceReason.toLowerCase()}` : ', dans la tolérance'}.`}
          </p>
          <button type="button" onClick={onClose} className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-text-primary)] text-lg font-semibold text-[var(--color-bg-base)]">
            Terminé
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {pendingSales > 0 && (
            <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-[15px] font-medium">
              {pendingSales} {pendingSales > 1 ? 'ventes' : 'vente'} pas encore envoyées : reconnectez la caisse avant de compter, sinon elles manqueront au total attendu.
            </p>
          )}
          <div className="grid gap-x-8 md:grid-cols-2">
            <section aria-label="Billets">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Billets</h3>
              <ul className="divide-y divide-[var(--color-border)]">{BILLS.map(row)}</ul>
            </section>
            <section aria-label="Pièces">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">Pièces</h3>
              <ul className="divide-y divide-[var(--color-border)]">{COINS.map(row)}</ul>
            </section>
          </div>
          <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-3">
            <p className="tabular flex items-baseline justify-between text-[17px]" aria-live="polite">
              <span>Total compté</span>
              <span className="text-3xl font-semibold">{formatPrice(counted)}</span>
            </p>
            {counted > 0 && needsReason == null && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Vous garderez {formatPrice(preview.keep / 100)} et déposerez {formatPrice(preview.deposit / 100)}.
              </p>
            )}
            {needsReason != null && (
              <fieldset className="space-y-2">
                <legend className="text-[15px] font-semibold">
                  {needsReason < 0 ? `Il manque ${formatPrice(-needsReason)}` : `Il y a ${formatPrice(needsReason)} de trop`} : pourquoi ?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {[...CASH_DIFFERENCE_REASONS, 'Je ne sais pas'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={reason === r}
                      onClick={() => setReason(r)}
                      className={['h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium', reason === r ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]'].join(' ')}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setNeedsReason(null); setReason(null) }} className="h-11 text-sm font-medium text-[var(--color-accent)]">
                  Recompter
                </button>
              </fieldset>
            )}
            <button
              type="button"
              disabled={saving || (needsReason != null && !reason)}
              onClick={submit}
              className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
            >
              {saving ? 'Fermeture...' : needsReason != null ? 'Fermer avec ce motif' : 'Valider le comptage'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
