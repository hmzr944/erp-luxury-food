'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Copy, Minus, Plus } from '@phosphor-icons/react'
import { formatPrice, planRefund } from '@erp/utils'
import { ordersApi, type ApiOrderDetail, type RefundTo, type StoreCreditView } from '@/lib/api/orders'
import { Sheet } from '@/components/pos/Sheet'
import { Loading } from '@/components/brand/FlowLogo'

const n = (v: number | string) => Number(v)

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Fiche d'une vente : lignes, paiements, retours déjà faits, et retour en un écran
export function OrderDetailSheet({
  siteId,
  orderId,
  startWithRefund,
  onUseCredit,
  onClose,
}: {
  siteId: string
  orderId: string | null
  startWithRefund?: boolean
  // En caisse : l'avoir de l'échange sert directement à la vente suivante
  onUseCredit?: (code: string) => void
  onClose: () => void
}) {
  const [refunding, setRefunding] = useState(false)
  const [done, setDone] = useState<{ total: number; label: string; credit: StoreCreditView | null } | null>(null)
  const order = useQuery({
    queryKey: ['order', siteId, orderId],
    queryFn: () => ordersApi.getById(siteId, orderId!),
    enabled: !!orderId,
  })

  useEffect(() => {
    setRefunding(!!startWithRefund)
    setDone(null)
  }, [orderId, startWithRefund])

  const o = order.data
  const counter = o?.receiptChain?.counter
  const title = done
    ? 'Remboursement enregistré'
    : refunding
      ? 'Retour ou échange'
      : o?.kind === 'REFUND'
        ? `Remboursement n° ${counter ?? ''}`
        : `Ticket n° ${counter ?? ''}`

  return (
    <Sheet open={!!orderId} title={title} onClose={onClose} width="lg">
      {!o ? (
        order.isError ? <p className="py-8 text-sm text-[var(--color-text-secondary)]">{(order.error as Error).message}</p> : <Loading className="py-8" />
      ) : done ? (
        <RefundDone siteId={siteId} done={done} onUseCredit={onUseCredit} onClose={onClose} />
      ) : refunding ? (
        <RefundForm siteId={siteId} order={o} onCancel={() => setRefunding(false)} onDone={setDone} />
      ) : (
        <OrderView order={o} onRefund={() => setRefunding(true)} />
      )}
    </Sheet>
  )
}

function remainingByItem(o: ApiOrderDetail) {
  const left = new Map(o.items.map((i) => [i.id, i.quantity]))
  for (const r of o.refunds) for (const i of r.items) if (i.refundOfItemId) left.set(i.refundOfItemId, (left.get(i.refundOfItemId) ?? 0) - i.quantity)
  return left
}

function OrderView({ order: o, onRefund }: { order: ApiOrderDetail; onRefund: () => void }) {
  const left = remainingByItem(o)
  const canRefund = o.kind !== 'REFUND' && o.status !== 'CANCELLED' && [...left.values()].some((q) => q > 0)
  const refunded = o.refunds.reduce((a, r) => a - n(r.total), 0)

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {dateTime(o.createdAt)}
        {o.site?.name ? `, ${o.site.name}` : ''}
        {o.customerEmail ? `, ${o.customerEmail}` : ''}
      </p>
      {o.refundOf && (
        <p className="text-sm">
          Retour du ticket n° {o.refundOf.receiptChain?.counter}
          {o.refundReason ? `, motif : ${o.refundReason}` : ''}
        </p>
      )}

      <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {o.items.map((i) => {
          const back = i.quantity - (left.get(i.id) ?? i.quantity)
          return (
            <li key={i.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">
                  <span className="tabular">{i.quantity} ×</span> {i.name}
                  {i.variantName ? `, ${i.variantName}` : ''}
                </p>
                {i.serialNumber && <p className="font-data text-sm text-[var(--color-text-secondary)]">N° {i.serialNumber}</p>}
                {back > 0 && o.kind !== 'REFUND' && (
                  <p className="text-sm font-medium text-[var(--color-accent)]">{back === i.quantity ? 'Rendu' : `${back} rendu${back > 1 ? 's' : ''}`}</p>
                )}
              </div>
              <p className="tabular shrink-0 text-[15px]">{formatPrice(n(i.price) * i.quantity - n(i.discount))}</p>
            </li>
          )
        })}
      </ul>

      <dl className="space-y-1 text-[15px]">
        {n(o.discount) > 0 && (
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <dt>Remise</dt>
            <dd className="tabular">−{formatPrice(n(o.discount))}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{formatPrice(n(o.total))}</dd>
        </div>
        {o.payments?.map((p, i) => (
          <div key={i} className="flex justify-between text-[var(--color-text-secondary)]">
            <dt>
              {p.label}
              {p.code === 'CREDIT' && p.reference ? <span className="font-data"> {p.reference}</span> : null}
            </dt>
            <dd className="tabular">{formatPrice(n(p.amount))}</dd>
          </div>
        ))}
      </dl>

      {o.refunds.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Remboursements, {formatPrice(refunded)} au total</h3>
          <ul className="space-y-2">
            {o.refunds.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] p-3 text-sm">
                <p className="flex justify-between gap-3 font-medium">
                  <span>
                    N° {r.receiptChain?.counter}, {dateTime(r.createdAt)}
                  </span>
                  <span className="tabular">{formatPrice(n(r.total))}</span>
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  {r.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                  {r.payments?.[0] ? `. ${r.payments[0].label}` : ''}
                  {r.payments?.[0]?.code === 'CREDIT' && r.payments[0].reference ? ` ${r.payments[0].reference}` : ''}
                  {r.refundReason ? `. ${r.refundReason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {o.note && <p className="whitespace-pre-line text-sm text-[var(--color-text-secondary)]">{o.note}</p>}

      {canRefund && (
        <button
          type="button"
          onClick={onRefund}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] press"
        >
          Retour ou échange
        </button>
      )}
    </div>
  )
}

const REASONS = ['Taille ou couleur', 'Ne convient pas', 'Défectueux', 'Erreur de caisse'] as const

function RefundForm({
  siteId,
  order: o,
  onCancel,
  onDone,
}: {
  siteId: string
  order: ApiOrderDetail
  onCancel: () => void
  onDone: (d: { total: number; label: string; credit: StoreCreditView | null }) => void
}) {
  const qc = useQueryClient()
  const left = useMemo(() => remainingByItem(o), [o])
  const refundable = o.items.filter((i) => (left.get(i.id) ?? 0) > 0)
  // Un seul article vendu : il est déjà sélectionné
  const [qty, setQty] = useState<Record<string, number>>(() =>
    refundable.length === 1 && refundable[0].quantity === 1 ? { [refundable[0].id]: 1 } : {},
  )
  const [reason, setReason] = useState<string | null>(null)
  const [restock, setRestock] = useState(true)
  const paid = (o.payments ?? []).filter((p) => n(p.amount) > 0)
  const single = paid.length === 1 ? paid[0] : null
  const [refundTo, setRefundTo] = useState<RefundTo>(single ? 'ORIGINAL' : 'CREDIT')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lines = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))

  // Même calcul que le serveur : le montant affiché est celui qui sera rendu
  const plan = useMemo(() => {
    if (!lines.length) return null
    try {
      const alreadyRefundedQty: Record<string, number> = {}
      for (const i of o.items) alreadyRefundedQty[i.id] = i.quantity - (left.get(i.id) ?? i.quantity)
      return planRefund({
        total: n(o.total),
        items: o.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: n(i.price), discount: n(i.discount), taxRate: n(i.taxRate) })),
        alreadyRefundedQty,
        alreadyRefundedAmount: o.refunds.reduce((a, r) => a - n(r.total), 0),
        lines,
      })
    } catch {
      return null
    }
  }, [lines, o, left])

  // Selon le moyen d'origine, « Espèces » ou « Avoir » fait doublon
  const options: Array<{ value: RefundTo; label: string; help: string }> = []
  if (single) {
    options.push({
      value: 'ORIGINAL',
      label: single.label,
      help:
        single.kind === 'CARD' && single.reference
          ? 'Le remboursement part sur la carte du client, via le TPE relié.'
          : single.kind === 'CARD'
            ? 'Remboursez la carte sur votre TPE, puis validez ici.'
            : single.code === 'CREDIT'
              ? 'Un nouvel avoir est émis.'
              : `Rendez le montant en ${single.label.toLowerCase()}.`,
    })
  }
  if (single?.code !== 'CASH') options.push({ value: 'CASH', label: 'Espèces', help: 'Rendez le montant en espèces.' })
  if (single?.code !== 'CREDIT') {
    options.push({ value: 'CREDIT', label: 'Avoir', help: "Utilisable en une ou plusieurs fois pendant 12 mois. Pour un échange, il paie le nouvel article." })
  }
  const chosen = options.find((x) => x.value === refundTo) ?? options[0]

  const submit = async () => {
    if (!plan) return
    setSaving(true)
    setError(null)
    try {
      const res = await ordersApi.refund(siteId, o.id, {
        lines,
        refundTo: chosen.value,
        restock,
        reason: reason ?? undefined,
        ...(chosen.value === 'CREDIT' ? { creditMonths: 12 } : {}),
      })
      await Promise.all([qc.invalidateQueries({ queryKey: ['orders', siteId] }), qc.invalidateQueries({ queryKey: ['order', siteId, o.id] })])
      onDone({ total: plan.total, label: chosen.label, credit: res.credit })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const allSelected = refundable.every((i) => qty[i.id] === left.get(i.id))

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <fieldset className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-semibold">Articles rendus</legend>
          {refundable.length > 1 && (
            <button
              type="button"
              onClick={() => setQty(allSelected ? {} : Object.fromEntries(refundable.map((i) => [i.id, left.get(i.id) ?? 0])))}
              className="h-11 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              {allSelected ? 'Ne rien rendre' : 'Tout rendre'}
            </button>
          )}
        </div>
        <ul className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {refundable.map((i) => {
            const max = left.get(i.id) ?? 0
            const q = qty[i.id] ?? 0
            const set = (v: number) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(max, v)) })
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">
                    {i.name}
                    {i.variantName ? `, ${i.variantName}` : ''}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {max} sur {i.quantity} {max > 1 ? 'retournables' : 'retournable'}
                    {i.serialNumber ? `, n° ${i.serialNumber}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Quantité rendue de ${i.name}`}>
                  <button
                    type="button"
                    onClick={() => set(q - 1)}
                    disabled={q === 0}
                    aria-label="Un de moins"
                    className="grid size-11 place-items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] disabled:opacity-30"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="tabular w-8 text-center text-lg font-semibold" aria-live="polite">
                    {q}
                  </span>
                  <button
                    type="button"
                    onClick={() => set(q + 1)}
                    disabled={q >= max}
                    aria-label="Un de plus"
                    className="grid size-11 place-items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] disabled:opacity-30"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Motif (facultatif)</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => {
                const next = reason === r ? null : r
                setReason(next)
                // Un article défectueux ne retourne pas en rayon
                setRestock(next !== 'Défectueux')
              }}
              className={[
                'h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium',
                reason === r ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
        Remettre en stock
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Rembourser en</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.map((x) => (
            <label
              key={x.value}
              className={[
                'flex h-12 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border px-2 text-center text-[15px] font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-accent)]',
                chosen.value === x.value ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]' : 'border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              <input type="radio" name="refund-to" value={x.value} checked={chosen.value === x.value} onChange={() => setRefundTo(x.value)} className="sr-only" />
              {x.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">{chosen.help}</p>
      </fieldset>

      {error && (
        <p role="alert" className="alert-box">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-14 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 text-[15px] font-medium">
          Retour
        </button>
        <button
          type="submit"
          disabled={!plan || saving}
          className="h-14 flex-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press"
        >
          {saving ? 'Remboursement...' : plan ? `Rembourser ${formatPrice(plan.total)}` : 'Choisissez les articles'}
        </button>
      </div>
    </form>
  )
}

function RefundDone({
  siteId,
  done,
  onUseCredit,
  onClose,
}: {
  siteId: string
  done: { total: number; label: string; credit: StoreCreditView | null }
  onUseCredit?: (code: string) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-5 pb-1">
      <p className="flex items-center gap-2 text-lg font-semibold">
        <CheckCircle size={26} weight="fill" aria-hidden className="text-[var(--color-accent)]" />
        {formatPrice(done.total)} en {done.label.toLowerCase()}
      </p>
      {done.credit ? (
        <>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-4 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">Code de l&apos;avoir, à donner au client</p>
            <p className="font-data mt-1 text-3xl font-semibold tracking-wider">{done.credit.code}</p>
            {done.credit.expiresAt && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Valable jusqu&apos;au {new Date(done.credit.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(done.credit!.code).then(() => setCopied(true))
              }}
              className="mx-auto mt-2 flex h-11 items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]"
            >
              <Copy size={16} aria-hidden /> {copied ? 'Copié' : 'Copier le code'}
            </button>
          </div>
          {onUseCredit ? (
            <button
              type="button"
              onClick={() => onUseCredit(done.credit!.code)}
              className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]"
            >
              Encaisser l&apos;échange avec cet avoir
            </button>
          ) : (
            <Link
              href={`/pos/${siteId}?avoir=${encodeURIComponent(done.credit.code)}`}
              className="flex h-14 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]"
            >
              Encaisser l&apos;échange avec cet avoir
            </Link>
          )}
        </>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className={
          done.credit
            ? 'h-12 w-full text-[15px] font-medium text-[var(--color-text-secondary)]'
            : 'h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)]'
        }
      >
        Terminé
      </button>
    </div>
  )
}
