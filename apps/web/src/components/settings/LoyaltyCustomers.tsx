'use client'

import { useEffect, useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { customerName, customersApi, displayPhone, type ApiCustomer, type LoyaltyEntryView } from '@/lib/api/customers'

const REASON: Record<LoyaltyEntryView['reason'], string> = {
  EARN: 'Achat',
  REDEEM: 'Récompense utilisée',
  REFUND: 'Remboursement',
  ADJUST: 'Ajustement',
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'jamais'

const field =
  'h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-base)] px-3 text-[15px] focus:border-[var(--color-accent)]'

// Fichier clients : retrouver un client, voir ses points, corriger un solde
// en cas de litige (motif obligatoire, tracé) et effacer ses données à sa demande
export function LoyaltyCustomers() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  const list = useQuery({ queryKey: ['customers', query], queryFn: () => customersApi.search(query), enabled: query.length !== 1 })
  const rows = list.data ?? []

  return (
    <section aria-labelledby="clients-title" className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="clients-title" className="text-[16px] font-semibold">
            Clients
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)]">Les clients se créent en caisse. Ici, vous corrigez un solde ou effacez une fiche.</p>
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Rechercher un client</span>
          <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Téléphone, e-mail ou nom" className={field + ' w-full pl-9'} />
        </label>
      </div>

      {list.isError ? (
        <p role="alert" className="alert-box">
          {(list.error as Error).message}
        </p>
      ) : list.isLoading ? (
        <p className="py-6 text-center text-[15px] text-[var(--color-text-muted)]">Chargement des clients...</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-[var(--color-text-secondary)]">
          {query ? 'Aucun client ne correspond.' : 'Aucun client pour l’instant. Ajoutez-en un depuis la caisse, sur la vente en cours.'}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {rows.map((c) => (
            <CustomerRow key={c.id} customer={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onDeleted={() => setOpen(null)} />
          ))}
        </ul>
      )}
      {!query && rows.length === 50 && <p className="text-sm text-[var(--color-text-muted)]">Les 50 clients vus le plus récemment. Cherchez pour retrouver les autres.</p>}
    </section>
  )
}

function CustomerRow({ customer: c, open, onToggle, onDeleted }: { customer: ApiCustomer; open: boolean; onToggle: () => void; onDeleted: () => void }) {
  const panelId = useId()
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left hover:bg-[var(--color-bg-hover)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{customerName(c)}</span>
          <span className="block truncate text-sm text-[var(--color-text-secondary)]">{[displayPhone(c.phone), c.email].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="hidden text-right text-sm text-[var(--color-text-secondary)] sm:block">Vu le {day(c.lastVisitAt)}</span>
        <span className="tabular w-20 text-right text-[15px] font-semibold">{c.points} pts</span>
        <CaretDown size={16} aria-hidden className={['shrink-0 text-[var(--color-text-muted)] transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')} />
      </button>
      {open && <CustomerDetail id={c.id} panelId={panelId} onDeleted={onDeleted} />}
    </li>
  )
}

function CustomerDetail({ id, panelId, onDeleted }: { id: string; panelId: string; onDeleted: () => void }) {
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['customer', id], queryFn: () => customersApi.get(id) })
  const [sign, setSign] = useState<1 | -1>(1)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const points = Math.round(Number(amount))
  const valid = Number.isInteger(points) && points > 0 && note.trim().length > 0

  const refresh = () => qc.invalidateQueries({ queryKey: ['customers'] })

  const adjust = async () => {
    setBusy(true)
    try {
      const next = await customersApi.adjust(id, { points: sign * points, note: note.trim() })
      qc.setQueryData(['customer', id], next)
      void refresh()
      setAmount('')
      setNote('')
      toast.success(`Solde corrigé : ${next.points} points`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await customersApi.remove(id)
      toast.success('Fiche client effacée')
      onDeleted()
      void refresh()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const c = detail.data
  return (
    <div id={panelId} className="space-y-5 px-1 pb-5 pt-2">
      {!c ? (
        <p className="text-[15px] text-[var(--color-text-muted)]">{detail.isError ? (detail.error as Error).message : 'Chargement...'}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px] sm:grid-cols-4">
            <Stat label="Points" value={`${c.points}`} />
            <Stat label="Récompense" value={c.reward.amount ? formatPrice(c.reward.amount) : 'aucune'} />
            <Stat label="Visites" value={`${c.visits}`} />
            <Stat label="Dépensé" value={formatPrice(c.totalSpent)} />
          </dl>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Client depuis le {day(c.createdAt)}. Offres de la boutique : {c.marketingOptIn ? 'acceptées' : 'refusées'}.
          </p>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Historique des points</h3>
            {c.entries.length === 0 ? (
              <p className="text-[15px] text-[var(--color-text-secondary)]">Aucun mouvement.</p>
            ) : (
              <ol className="space-y-1.5">
                {c.entries.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-3 text-[15px] leading-snug">
                    <span className="tabular w-24 shrink-0 text-sm text-[var(--color-text-muted)]">{day(e.createdAt)}</span>
                    <span className="min-w-0 flex-1">
                      {REASON[e.reason]}
                      {e.note && <span className="text-[var(--color-text-secondary)]"> : {e.note}</span>}
                    </span>
                    <span className={['tabular shrink-0 font-medium', e.points < 0 ? 'text-[var(--color-text-secondary)]' : ''].join(' ')}>
                      {e.points > 0 ? '+' : ''}
                      {e.points}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <form
            className="space-y-3 border-t border-[var(--color-border)] pt-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid) void adjust()
            }}
          >
            <h3 className="text-sm font-semibold">Corriger le solde</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Sens de la correction" className="flex rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] p-0.5">
                {([1, -1] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={sign === s}
                    onClick={() => setSign(s)}
                    className={['h-10 rounded-[var(--radius-pill)] px-4 text-sm font-medium', sign === s ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'text-[var(--color-text-secondary)]'].join(' ')}
                  >
                    {s === 1 ? 'Ajouter' : 'Retirer'}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[15px]">
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} aria-label="Nombre de points" className={field + ' tabular w-24 text-right'} />
                points
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm">Motif (visible dans l’historique et le journal)</span>
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : geste commercial après litige" className={field + ' w-full'} />
            </label>
            <button type="submit" disabled={!valid || busy} className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] disabled:opacity-40">
              {valid ? `${sign === 1 ? 'Ajouter' : 'Retirer'} ${points} points` : 'Corriger le solde'}
            </button>
          </form>

          <div className="border-t border-[var(--color-border)] pt-4">
            {confirming ? (
              <div role="alertdialog" aria-label="Confirmer l’effacement" className="space-y-3">
                <p className="text-[15px]">
                  Effacer {customerName(c)} ? Ses coordonnées et ses points disparaissent. Les ventes restent dans la caisse, sans nom.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void remove()} className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-danger)] px-5 text-sm font-semibold text-white disabled:opacity-50">
                    Effacer définitivement
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] px-5 text-sm font-medium">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="h-11 text-sm font-medium text-[var(--color-danger)] underline-offset-4 hover:underline">
                Effacer cette fiche à la demande du client
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="tabular text-[17px] font-semibold">{value}</dd>
    </div>
  )
}
