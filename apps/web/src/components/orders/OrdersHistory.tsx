'use client'

import { useEffect, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { ordersApi, type ApiOrder } from '@/lib/api/orders'
import { OrderDetailSheet } from './OrderDetailSheet'

const PAGE = 40

type Kind = 'ALL' | 'SALE' | 'REFUND'
type Period = 'today' | 'week' | 'all'

const KINDS: Array<{ key: Kind; label: string }> = [
  { key: 'ALL', label: 'Tout' },
  { key: 'SALE', label: 'Ventes' },
  { key: 'REFUND', label: 'Retours' },
]
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: '7 jours' },
  { key: 'all', label: 'Tout' },
]

function since(period: Period) {
  if (period === 'all') return undefined
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (period === 'week') d.setDate(d.getDate() - 6)
  return d.toISOString()
}

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// Historique : retrouver une vente en une recherche (n° de ticket, client,
// produit, n° de série ou code d'avoir), sans limite de date pour un retour
export function OrdersHistory({ siteId }: { siteId: string }) {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Kind>('ALL')
  const [period, setPeriod] = useState<Period>('today')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setQ(input.trim()), 250)
    return () => window.clearTimeout(t)
  }, [input])

  // Une recherche porte sur tout l'historique
  const from = q ? undefined : since(period)
  const list = useInfiniteQuery({
    queryKey: ['orders', siteId, 'history', q, kind, from],
    queryFn: ({ pageParam }) =>
      ordersApi.getAll(siteId, { q, kind: kind === 'ALL' ? undefined : kind, from, limit: PAGE, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
  })
  const orders = list.data?.pages.flat() ?? []

  const sales = orders.filter((o) => o.kind !== 'REFUND')
  const net = orders.reduce((a, o) => a + Number(o.total), 0)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 md:px-6">
      <div className="relative">
        <MagnifyingGlass size={20} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        <label htmlFor="orders-search" className="sr-only">
          Rechercher une vente
        </label>
        <input
          id="orders-search"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="N° de ticket, e-mail, produit, code d'avoir"
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-12 pr-4 text-base focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented label="Type" value={kind} options={KINDS} onChange={setKind} />
        {!q && <Segmented label="Période" value={period} options={PERIODS} onChange={setPeriod} />}
      </div>

      {!list.isLoading && orders.length > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]" aria-live="polite">
          {sales.length} {sales.length > 1 ? 'ventes' : 'vente'}
          {orders.length > sales.length ? `, ${orders.length - sales.length} ${orders.length - sales.length > 1 ? 'retours' : 'retour'}` : ''}
          , net <span className="tabular font-medium text-[var(--color-text-primary)]">{formatPrice(net)}</span>
          {list.hasNextPage ? ', sur les ventes affichées' : ''}
        </p>
      )}

      {list.isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-hover)]" />
          ))}
        </div>
      ) : list.isError ? (
        <p role="alert" className="alert-box">
          {(list.error as Error).message}
        </p>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[15px] font-medium">{q ? `Rien ne correspond à « ${q} »` : 'Aucune vente sur cette période'}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {q ? 'Essayez le numéro imprimé sur le ticket.' : 'Les ventes de la caisse apparaissent ici dès leur envoi.'}
          </p>
        </div>
      ) : (
        <OrderList orders={orders} onOpen={setOpen} />
      )}

      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[15px] font-medium hover:border-[var(--color-accent)]"
        >
          {list.isFetchingNextPage ? 'Chargement...' : 'Voir les ventes précédentes'}
        </button>
      )}

      <OrderDetailSheet siteId={siteId} orderId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function OrderList({ orders, onOpen }: { orders: ApiOrder[]; onOpen: (id: string) => void }) {
  const groups: Array<{ day: string; orders: ApiOrder[] }> = []
  for (const o of orders) {
    const day = dayLabel(o.createdAt)
    if (groups.at(-1)?.day !== day) groups.push({ day, orders: [] })
    groups.at(-1)!.orders.push(o)
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day} aria-label={g.day}>
          <h2 className="mb-1 text-sm font-semibold first-letter:uppercase">{g.day}</h2>
          <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
            {g.orders.map((o) => (
              <li key={o.id}>
                <OrderRow order={o} onOpen={() => onOpen(o.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function OrderRow({ order: o, onOpen }: { order: ApiOrder; onOpen: () => void }) {
  const refund = o.kind === 'REFUND'
  const refunded = (o.refunds ?? []).reduce((a, r) => a - Number(r.total), 0)
  const what = o.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(', ')
  const how = [...new Set((o.payments ?? []).map((p) => p.label))].join(' + ')
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--color-bg-hover)] focus-visible:relative"
    >
      <span className="tabular w-12 shrink-0 text-sm text-[var(--color-text-secondary)]">
        {new Date(o.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">
          {refund ? `Retour du n° ${o.refundOf?.receiptChain?.counter ?? '?'} : ` : ''}
          {what}
        </span>
        <span className="block truncate text-sm text-[var(--color-text-secondary)]">
          N° {o.receiptChain?.counter ?? '?'}
          {how ? `, ${how}` : ''}
          {o.customerEmail ? `, ${o.customerEmail}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={['tabular block text-[15px] font-semibold', refund ? 'text-[var(--color-accent)]' : ''].join(' ')}>
          {formatPrice(Number(o.total))}
        </span>
        {refunded > 0 && <span className="tabular block text-sm text-[var(--color-accent)]">{formatPrice(-refunded)} rendu</span>}
      </span>
    </button>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[var(--radius-pill)] bg-[var(--color-bg-hover)] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={[
            'h-10 rounded-[var(--radius-pill)] px-3.5 text-sm font-medium transition-colors duration-150',
            value === o.key ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
