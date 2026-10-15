'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPrice, giftCardCode } from '@erp/utils'
import { customerName, customersApi, type ApiCustomer } from '@/lib/api/customers'
import { Sheet } from './Sheet'

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)]'
const primaryCls =
  'h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]'

const parseAmount = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

// Client fidélité : retrouvé par téléphone, e-mail ou nom, ou créé en deux champs
export function CustomerSheet({ open, onClose, onChoose }: { open: boolean; onClose: () => void; onChoose: (c: ApiCustomer) => void }) {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ firstName: '', phone: '', email: '', marketingOptIn: false })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQ('')
      setQuery('')
      setCreating(false)
      setError(null)
      setForm({ firstName: '', phone: '', email: '', marketingOptIn: false })
    }
  }, [open])
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  const results = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customersApi.search(query),
    enabled: open && query.length >= 2,
    staleTime: 10_000,
  })

  const startCreate = () => {
    // Ce qui a été tapé pré-remplit le bon champ
    const typed = q.trim()
    setForm((f) => ({
      ...f,
      ...(typed.includes('@') ? { email: typed } : /^[\d\s+.]+$/.test(typed) ? { phone: typed } : { firstName: typed }),
    }))
    setCreating(true)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onChoose(
        await customersApi.create({
          firstName: form.firstName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          marketingOptIn: form.marketingOptIn,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Client non enregistré')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} title={creating ? 'Nouveau client' : 'Client fidélité'} onClose={onClose}>
      {typeof navigator !== 'undefined' && !navigator.onLine ? (
        <p className="alert-box">La recherche de clients demande une connexion. La vente peut continuer sans client.</p>
      ) : creating ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="space-y-2">
            <label htmlFor="cust-phone" className="block text-sm font-medium">
              Téléphone
            </label>
            <input id="cust-phone" data-autofocus type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldCls} />
          </div>
          <div className="space-y-2">
            <label htmlFor="cust-email" className="block text-sm font-medium">
              E-mail
            </label>
            <input id="cust-email" type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldCls} />
          </div>
          <div className="space-y-2">
            <label htmlFor="cust-first" className="block text-sm font-medium">
              Prénom (facultatif)
            </label>
            <input id="cust-first" autoComplete="off" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={fieldCls} />
          </div>
          <label className="flex items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })}
              className="mt-1 size-5 accent-[var(--color-accent)]"
            />
            <span>Le client accepte de recevoir les offres de la boutique</span>
          </label>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Téléphone ou e-mail suffit. Ces coordonnées servent au programme de fidélité ; le client peut demander leur suppression à tout moment.
          </p>
          {error && (
            <p role="alert" className="alert-box">
              {error}
            </p>
          )}
          <button type="submit" disabled={saving || (!form.phone.trim() && !form.email.trim())} className={primaryCls}>
            {saving ? 'Enregistrement...' : 'Enregistrer et rattacher'}
          </button>
          <button type="button" onClick={() => setCreating(false)} className="h-11 w-full text-sm font-medium text-[var(--color-text-secondary)]">
            Revenir à la recherche
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="cust-search" className="block text-sm font-medium">
              Téléphone, e-mail ou nom
            </label>
            <input
              id="cust-search"
              data-autofocus
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results.data?.length === 1) onChoose(results.data[0])
              }}
              className={fieldCls}
            />
          </div>
          {results.isError && (
            <p role="alert" className="alert-box">
              {(results.error as Error).message}
            </p>
          )}
          {query.length >= 2 && results.data && (
            <ul aria-label="Clients trouvés" className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              {results.data.length === 0 && <li className="p-4 text-[15px] text-[var(--color-text-secondary)]">Aucun client trouvé.</li>}
              {results.data.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onChoose(c)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[var(--color-bg-hover)]">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{customerName(c)}</span>
                      <span className="block truncate text-sm text-[var(--color-text-secondary)]">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm">
                      <span className="tabular block font-semibold">{c.points} pts</span>
                      {c.reward.amount > 0 && <span className="block text-[var(--color-accent)]">{formatPrice(c.reward.amount)} offerts</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={startCreate} className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-semibold hover:border-[var(--color-accent)]">
            Nouveau client
          </button>
        </div>
      )}
    </Sheet>
  )
}

const PRESETS = [20, 50, 100]

// Carte cadeau vendue : montant choisi, code tiré par la caisse (même hors ligne)
export function GiftCardSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (card: { code: string; amount: number }) => void }) {
  const [amount, setAmount] = useState('')
  const [code, setCode] = useState('')
  const value = parseAmount(amount)
  const tooHigh = !!value && value > 1500

  useEffect(() => {
    if (open) {
      setAmount('')
      setCode(giftCardCode((n) => crypto.getRandomValues(new Uint8Array(n))))
    }
  }, [open])

  return (
    <Sheet open={open} title="Carte cadeau" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (value && !tooHigh) onAdd({ code, amount: value })
        }}
      >
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={value === p}
              onClick={() => setAmount(String(p))}
              className={[
                'h-12 flex-1 rounded-[var(--radius-pill)] text-[15px] font-semibold tabular',
                value === p ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              {formatPrice(p)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <label htmlFor="gift-amount" className="block text-sm font-medium">
            Montant
          </label>
          <input
            id="gift-amount"
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldCls + ' tabular h-16 text-3xl font-semibold'}
          />
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Code imprimé sur le ticket : <span className="font-data text-[var(--color-text-primary)]">{code}</span>. Vendue sans TVA, la TVA est due sur les achats payés avec la carte.
        </p>
        {tooHigh && (
          <p role="alert" className="alert-box">
            1 500 € au plus par carte.
          </p>
        )}
        <button type="submit" disabled={!value || tooHigh} className={primaryCls}>
          {value ? `Ajouter une carte de ${formatPrice(value)}` : 'Ajouter'}
        </button>
      </form>
    </Sheet>
  )
}
