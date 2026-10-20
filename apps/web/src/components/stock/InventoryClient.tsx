'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CheckCircle, ClipboardText, Hourglass, Lock, MagnifyingGlass, Scan, Warning, XCircle,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  inventoryApi, type InventoryApi, type InventoryDetailApi, type InventoryLineApi, type InventoryStatus,
} from '@/lib/api/inventory'
import { CORRECTION_REASONS, type CorrectionReason } from '@/lib/api/stock'
import { productsApi } from '@/lib/api/products'
import { FieldError } from '@/components/ui/FieldError'
import { Sheet } from './Sheet'
import { afterScan, countedOf, filterLines, findScanMatch, lineGap, summarize, type LineFilter } from './inventory-logic'
import { formatGap, formatQty, parseQty } from './stock-format'

const PAGE = 100

const STATUS: Record<InventoryStatus, { label: string; Icon: typeof Hourglass }> = {
  DRAFT: { label: 'En cours', Icon: Hourglass },
  VALIDATED: { label: 'Validé', Icon: CheckCircle },
  CANCELLED: { label: 'Annulé', Icon: XCircle },
}

const fieldCls =
  'h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 font-body text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]'
const primaryBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-semibold text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60'
const ghostBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 font-body text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] active:scale-[0.98] disabled:opacity-60'

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function StatusBadge({ status }: { status: InventoryStatus }) {
  const { label, Icon } = STATUS[status]
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 font-body text-xs font-semibold',
        status === 'DRAFT'
          ? 'bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]'
          : status === 'VALIDATED'
            ? 'bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)]'
            : 'border border-[var(--color-border-strong)] text-[var(--color-text-secondary)]',
      ].join(' ')}
    >
      <Icon size={12} weight={status === 'DRAFT' ? 'regular' : 'fill'} aria-hidden /> {label}
    </span>
  )
}

export function InventoryClient({
  siteId, siteName, canEdit, viewId,
}: { siteId: string; siteName: string; canEdit: boolean; viewId: string | null }) {
  const current = useQuery({ queryKey: ['inventory-current', siteId], queryFn: () => inventoryApi.current(siteId) })
  const history = useQuery({ queryKey: ['inventory-list', siteId], queryFn: () => inventoryApi.list(siteId) })
  const viewed = useQuery({
    queryKey: ['inventory-detail', siteId, viewId],
    queryFn: () => inventoryApi.get(siteId, viewId!),
    enabled: !!viewId,
  })

  if (viewId) {
    return (
      <Shell>
        <Link href="/stock/inventaire" className="mb-4 inline-flex min-h-11 items-center gap-1.5 font-body text-sm font-semibold text-[var(--color-accent)] hover:underline">
          <ArrowLeft size={16} aria-hidden /> Retour aux inventaires
        </Link>
        {viewed.isLoading && <p className="font-body text-sm text-[var(--color-text-secondary)]">Chargement…</p>}
        {viewed.error && <FieldError>{(viewed.error as Error).message}</FieldError>}
        {viewed.data && <InventoryView siteId={siteId} siteName={siteName} inventory={viewed.data} canEdit={canEdit} />}
      </Shell>
    )
  }

  if (current.isLoading) {
    return (
      <Shell>
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)]" />
      </Shell>
    )
  }

  if (current.data) {
    return (
      <Shell>
        <InventoryView siteId={siteId} siteName={siteName} inventory={current.data} canEdit={canEdit} />
      </Shell>
    )
  }

  return (
    <Shell>
      <StartPanel siteId={siteId} canEdit={canEdit} />
      <History items={history.data ?? []} loading={history.isLoading} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">{children}</div>
    </div>
  )
}

// ── Démarrer et historique ─────────────────────────────────────

function StartPanel({ siteId, canEdit }: { siteId: string; canEdit: boolean }) {
  const qc = useQueryClient()
  const [categoryId, setCategoryId] = useState('')
  const categories = useQuery({ queryKey: ['categories', siteId], queryFn: () => productsApi.getCategories(siteId) })

  const start = useMutation({
    mutationFn: () => inventoryApi.start(siteId, categoryId || undefined),
    onSuccess: (inv) => {
      qc.setQueryData(['inventory-current', siteId], inv)
      qc.invalidateQueries({ queryKey: ['inventory-list', siteId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section aria-labelledby="inv-start" className="mb-8">
      <h1 id="inv-start" className="page-title">Inventaire</h1>
      <p className="mt-1 max-w-2xl font-body text-sm text-[var(--color-text-secondary)]">
        Comptez ce qui est réellement en rayon ou en réserve. Le stock attendu est figé au démarrage ; à la validation, chaque écart est écrit dans le stock.
      </p>
      {canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            start.mutate()
          }}
          className="mt-4 flex max-w-xl flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
        >
          <div className="min-w-48 flex-1 space-y-1.5">
            <label htmlFor="inv-scope" className="font-body text-sm font-medium">Ce qu’on compte</label>
            <select id="inv-scope" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls + ' cursor-pointer'}>
              <option value="">Tout le catalogue</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={start.isPending} className={primaryBtn}>
            <ClipboardText size={18} aria-hidden /> {start.isPending ? 'Préparation…' : 'Démarrer l’inventaire'}
          </button>
        </form>
      ) : (
        <p className="mt-4 font-body text-sm text-[var(--color-text-secondary)]">Consultation seule : le titulaire et le gérant font les inventaires.</p>
      )}
    </section>
  )
}

function History({ items, loading }: { items: InventoryApi[]; loading: boolean }) {
  return (
    <section aria-labelledby="inv-history">
      <h2 id="inv-history" className="font-display text-lg font-bold tracking-tight">Historique</h2>
      {loading ? (
        <div className="mt-3 h-16 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)]" />
      ) : items.length === 0 ? (
        <p className="mt-3 font-body text-sm text-[var(--color-text-secondary)]">Aucun inventaire pour l’instant.</p>
      ) : (
        <>
          <table className="mt-3 hidden w-full border-collapse md:table">
            <caption className="sr-only">Inventaires du site, du plus récent au plus ancien</caption>
            <thead>
              <tr className="border-b border-[var(--color-border-strong)] text-left font-body text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 font-medium">Portée</th>
                <th scope="col" className="px-3 py-2 font-medium">État</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Comptés</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Écarts</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Surplus</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Manquants</th>
                <th scope="col" className="py-2 pl-3"><span className="sr-only">Ouvrir</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-[var(--color-border)] font-body text-sm">
                  <td className="tabular py-3 pr-3">{dateTime(i.validatedAt ?? i.cancelledAt ?? i.createdAt)}</td>
                  <td className="px-3 py-3">{i.categoryName ?? 'Tout le catalogue'}</td>
                  <td className="px-3 py-3"><StatusBadge status={i.status} /></td>
                  <td className="tabular px-3 py-3 text-right">{i.summary.counted} / {i.summary.total}</td>
                  <td className="tabular px-3 py-3 text-right">{i.summary.withGap}</td>
                  <td className="tabular px-3 py-3 text-right">{formatGap(i.summary.surplus)}</td>
                  <td className="tabular px-3 py-3 text-right">{formatGap(i.summary.missing)}</td>
                  <td className="py-3 pl-3 text-right">
                    <Link href={i.status === 'DRAFT' ? '/stock/inventaire' : `/stock/inventaire?id=${i.id}`} className="inline-flex min-h-9 items-center font-semibold text-[var(--color-accent)] hover:underline">
                      {i.status === 'DRAFT' ? 'Reprendre' : 'Voir'}<span className="sr-only"> l’inventaire du {dateOnly(i.createdAt)}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 space-y-3 md:hidden">
            {items.map((i) => (
              <li key={i.id} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 font-body text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular font-medium">{dateTime(i.validatedAt ?? i.cancelledAt ?? i.createdAt)}</span>
                  <StatusBadge status={i.status} />
                </div>
                <p className="text-[var(--color-text-secondary)]">{i.categoryName ?? 'Tout le catalogue'}</p>
                <p className="tabular">{i.summary.counted} comptés sur {i.summary.total}, {i.summary.withGap} écart{i.summary.withGap > 1 ? 's' : ''} ({formatGap(i.summary.surplus)} / {formatGap(i.summary.missing)})</p>
                <Link href={`/stock/inventaire?id=${i.id}`} className="inline-flex min-h-11 items-center font-semibold text-[var(--color-accent)] hover:underline">Voir le détail</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// ── Un inventaire : comptage (brouillon) ou lecture (validé, annulé) ──

function InventoryView({
  siteId, siteName, inventory, canEdit,
}: { siteId: string; siteName: string; inventory: InventoryDetailApi; canEdit: boolean }) {
  const qc = useQueryClient()
  const router = useRouter()
  const editable = inventory.status === 'DRAFT' && canEdit
  const key = inventory.status === 'DRAFT' ? ['inventory-current', siteId] : ['inventory-detail', siteId, inventory.id]
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LineFilter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [scanAdds, setScanAdds] = useState(true)
  const [flash, setFlash] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [miss, setMiss] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'validate' | 'cancel' | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  // Les enregistrements partent un par un, dans l'ordre des gestes : deux
  // passages de douchette rapprochés ne se doublent pas à l'arrivée
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  const lines = inventory.lines
  const summary = useMemo(() => summarize(lines), [lines])
  const shown = useMemo(() => filterLines(lines, query, filter), [lines, query, filter])
  const visible = shown.slice(0, limit)

  useEffect(() => setLimit(PAGE), [query, filter])
  useEffect(() => {
    if (editable) scanRef.current?.focus()
  }, [editable])

  const patchLine = (lineId: string, patch: Partial<InventoryLineApi>) =>
    qc.setQueryData<InventoryDetailApi | null>(key, (old) =>
      old
        ? {
            ...old,
            lines: old.lines.map((l) => {
              if (l.id !== lineId) return l
              const next = { ...l, ...patch }
              return { ...next, gap: lineGap(next) }
            }),
          }
        : old,
    )

  const save = (line: InventoryLineApi, data: { countedQty?: number | null; reasonCode?: CorrectionReason | '' }) => {
    patchLine(line.id, {
      ...(data.countedQty !== undefined ? { countedQty: data.countedQty } : {}),
      ...(data.reasonCode !== undefined ? { reasonCode: data.reasonCode || null } : {}),
    })
    chain.current = chain.current
      .then(() => inventoryApi.countLine(siteId, inventory.id, line.id, data))
      .catch((e: Error) => {
        toast.error(`${line.name} : ${e.message}`)
        qc.invalidateQueries({ queryKey: key })
      })
  }

  const scan = () => {
    const raw = query.trim()
    if (!raw) return
    const match = findScanMatch(lines, raw)
    if (!match) {
      const some = filterLines(lines, raw, 'all').length
      setMiss(some === 0 ? `Aucun produit pour « ${raw} »` : null)
      scanRef.current?.select()
      return
    }
    setMiss(null)
    if (scanAdds) {
      const next = afterScan(match)
      save(match, { countedQty: next })
      setAnnounce(`${match.name} : ${formatQty(next)} compté${next > 1 ? 's' : ''}`)
      setFlash(match.id)
      window.setTimeout(() => setFlash((f) => (f === match.id ? null : f)), 900)
      setQuery('')
      setFilter('all')
    } else {
      setFilter('all')
      setQuery('')
      window.setTimeout(() => {
        const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-line="${match.id}"]`)
        el?.focus()
        el?.select()
      }, 30)
    }
  }

  const validate = useMutation({
    mutationFn: () => inventoryApi.validate(siteId, inventory.id),
    onSuccess: (res) => {
      qc.setQueryData(['inventory-current', siteId], null)
      qc.setQueryData(['inventory-detail', siteId, inventory.id], res)
      for (const k of ['inventory-list', 'stock-inventory', 'stock-movements', 'stock-alerts']) qc.invalidateQueries({ queryKey: [k, siteId] })
      toast.success(`Inventaire validé : ${res.adjusted ?? 0} correction${(res.adjusted ?? 0) > 1 ? 's' : ''} écrite${(res.adjusted ?? 0) > 1 ? 's' : ''} dans le stock`)
      setDialog(null)
      router.replace(`/stock/inventaire?id=${inventory.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancel = useMutation({
    mutationFn: () => inventoryApi.cancel(siteId, inventory.id),
    onSuccess: () => {
      qc.setQueryData(['inventory-current', siteId], null)
      qc.invalidateQueries({ queryKey: ['inventory-list', siteId] })
      toast.success('Inventaire annulé, le stock n’a pas bougé')
      setDialog(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const when = inventory.validatedAt ?? inventory.cancelledAt ?? inventory.createdAt
  const pct = summary.total ? Math.round((summary.counted / summary.total) * 100) : 0
  const gapsList = lines.filter((l) => (lineGap(l) ?? 0) !== 0)

  const FILTERS: Array<{ key: LineFilter; label: string; n: number }> = [
    { key: 'all', label: 'Tous', n: summary.total },
    { key: 'todo', label: 'À compter', n: summary.uncounted },
    { key: 'gaps', label: 'Écarts', n: summary.withGap },
  ]

  return (
    <>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Inventaire du {dateOnly(when)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-[var(--color-text-secondary)]">
            <StatusBadge status={inventory.status} />
            <span>{inventory.categoryName ?? 'Tout le catalogue'}, {siteName}</span>
            <span>Démarré le {dateTime(inventory.createdAt)}</span>
            {inventory.status !== 'DRAFT' && (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--color-text-primary)]">
                <Lock size={14} aria-hidden /> Verrouillé, non modifiable
              </span>
            )}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog('cancel')} className={ghostBtn}>Annuler l’inventaire</button>
            <button type="button" onClick={() => setDialog('validate')} disabled={summary.counted === 0} className={primaryBtn}>
              Valider l’inventaire
            </button>
          </div>
        )}
      </header>

      <section aria-label="Bilan" className="mb-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:grid-cols-[1.4fr_2.6fr]">
        <div>
          <p className="font-body text-sm text-[var(--color-text-secondary)]">Avancement</p>
          <p className="tabular font-display text-2xl font-bold">{summary.counted} <span className="text-base font-normal text-[var(--color-text-secondary)]">sur {summary.total} comptés</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avancement du comptage">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Lignes en écart" value={String(summary.withGap)} />
          <Stat label="Surplus" unit="quantité" value={formatGap(summary.surplus)} />
          <Stat label="Manquants" unit="quantité" value={formatGap(summary.missing)} />
        </div>
      </section>

      {editable && (
        <section aria-label="Scanner ou chercher" className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Scan size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <label htmlFor="inv-scan" className="sr-only">Scanner un code-barres ou chercher par nom ou SKU</label>
              <input
                id="inv-scan"
                ref={scanRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setMiss(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    scan()
                  }
                }}
                autoComplete="off"
                inputMode="search"
                spellCheck={false}
                placeholder="Scanner, ou taper un nom ou un SKU"
                className={fieldCls + ' pl-10'}
                aria-describedby="inv-scan-help"
              />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 font-body text-sm text-[var(--color-text-primary)]">
              <input type="checkbox" checked={scanAdds} onChange={(e) => setScanAdds(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
              Chaque scan ajoute 1
            </label>
          </div>
          <p id="inv-scan-help" className="font-body text-xs text-[var(--color-text-secondary)]">
            {scanAdds
              ? 'Entrée sur un code-barres ou un SKU exact : la quantité comptée monte de 1. Corrigez ensuite dans le tableau.'
              : 'Entrée sur un code-barres ou un SKU exact : le curseur va sur la quantité du produit.'}
          </p>
          {miss && <FieldError>{miss}</FieldError>}
          <p role="status" aria-live="polite" className="sr-only">{announce}</p>
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrer les lignes" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={[
                'min-h-10 rounded-[var(--radius-pill)] border px-3.5 font-body text-sm transition-colors',
                filter === f.key
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] font-semibold text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border-strong)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              {f.label} <span className="tabular">({f.n})</span>
            </button>
          ))}
        </div>
        {!editable && (
          <div className="relative ml-auto w-full min-w-48 sm:w-64">
            <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <label htmlFor="inv-search" className="sr-only">Chercher dans l’inventaire</label>
            <input id="inv-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, SKU ou code-barres" className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-9 pr-3 font-body text-sm" />
          </div>
        )}
      </div>

      <div ref={tableRef}>
        {visible.length === 0 ? (
          <p className="py-12 text-center font-body text-sm text-[var(--color-text-secondary)]">
            {filter === 'gaps' ? 'Aucun écart pour l’instant.' : filter === 'todo' ? 'Tout est compté.' : 'Aucun produit ne correspond.'}
          </p>
        ) : (
          <>
            <table className="hidden w-full border-collapse md:table">
              <caption className="sr-only">Lignes de l’inventaire : quantité attendue, comptée, écart et motif</caption>
              <thead>
                <tr className="border-b border-[var(--color-border-strong)] text-left font-body text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <th scope="col" className="py-2 pr-3 font-medium">Produit</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Attendu</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Compté</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Écart</th>
                  <th scope="col" className="py-2 pl-3 font-medium">Motif</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => (
                  <tr key={l.id} className={['border-b border-[var(--color-border)] align-middle transition-colors duration-500', flash === l.id ? 'bg-[var(--color-accent-muted)]' : ''].join(' ')}>
                    <th scope="row" className="max-w-[30ch] py-2.5 pr-3 text-left font-normal">
                      <span className="block truncate font-body text-[15px] font-medium">{l.name}</span>
                      {(l.sku || l.barcode) && <span className="block truncate font-data text-xs text-[var(--color-text-secondary)]">{l.sku ?? l.barcode}</span>}
                    </th>
                    <td className="tabular px-3 py-2.5 text-right font-body text-[15px] text-[var(--color-text-secondary)]">{formatQty(l.expectedQty)} {l.unit}</td>
                    <td className="px-3 py-2.5 text-right">
                      <CountField line={l} editable={editable} onCommit={(v) => save(l, { countedQty: v })} />
                    </td>
                    <td className="px-3 py-2.5 text-right"><GapCell line={l} /></td>
                    <td className="py-2.5 pl-3"><ReasonCell line={l} editable={editable} onChange={(code) => save(l, { reasonCode: code })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="space-y-3 md:hidden">
              {visible.map((l) => (
                <li key={l.id} className={['space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 transition-colors duration-500', flash === l.id ? 'bg-[var(--color-accent-muted)]' : 'bg-[var(--color-bg-surface)]'].join(' ')}>
                  <div>
                    <p className="font-body text-[15px] font-medium">{l.name}</p>
                    {(l.sku || l.barcode) && <p className="font-data text-xs text-[var(--color-text-secondary)]">{l.sku ?? l.barcode}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-body text-sm text-[var(--color-text-secondary)]">Attendu : <span className="tabular">{formatQty(l.expectedQty)} {l.unit}</span></p>
                    <GapCell line={l} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-body text-sm">Compté</span>
                    <CountField line={l} editable={editable} onCommit={(v) => save(l, { countedQty: v })} />
                  </div>
                  {(lineGap(l) ?? 0) !== 0 && <ReasonCell line={l} editable={editable} onChange={(code) => save(l, { reasonCode: code })} />}
                </li>
              ))}
            </ul>
            {shown.length > limit && (
              <div className="py-4 text-center">
                <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={ghostBtn}>
                  Afficher {Math.min(PAGE, shown.length - limit)} lignes de plus ({shown.length - limit} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {dialog === 'validate' && (
          <Sheet
            title="Valider l’inventaire"
            description="Les écarts sont écrits dans le stock, puis l’inventaire est verrouillé."
            onClose={() => setDialog(null)}
            footer={
              <>
                <button type="button" onClick={() => setDialog(null)} className={ghostBtn + ' flex-1'}>Continuer le comptage</button>
                <button type="button" data-autofocus onClick={() => validate.mutate()} disabled={validate.isPending} className={primaryBtn + ' flex-1'}>
                  {validate.isPending ? 'Écriture…' : 'Valider et corriger'}
                </button>
              </>
            }
          >
            <ul className="space-y-1.5 font-body text-sm">
              <li><strong className="tabular">{summary.withGap}</strong> correction{summary.withGap > 1 ? 's' : ''} de stock (surplus <span className="tabular">{formatGap(summary.surplus)}</span>, manquants <span className="tabular">{formatGap(summary.missing)}</span>)</li>
              <li><strong className="tabular">{summary.counted - summary.withGap}</strong> ligne{summary.counted - summary.withGap > 1 ? 's' : ''} sans écart</li>
              <li className="flex items-start gap-2"><Warning size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0" /><span><strong className="tabular">{summary.uncounted}</strong> ligne{summary.uncounted > 1 ? 's' : ''} non comptée{summary.uncounted > 1 ? 's' : ''} : leur stock ne change pas.</span></li>
            </ul>
            {gapsList.length > 0 && (
              <div>
                <h3 className="mb-1.5 font-body text-sm font-semibold">Écarts à écrire</h3>
                <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  {gapsList.slice(0, 8).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 font-body text-sm">
                      <span className="truncate">{l.name}</span>
                      <span className="tabular shrink-0 font-semibold">{formatGap(lineGap(l) ?? 0)} {l.unit}</span>
                    </li>
                  ))}
                </ul>
                {gapsList.length > 8 && <p className="mt-1.5 font-body text-xs text-[var(--color-text-secondary)]">et {gapsList.length - 8} autre{gapsList.length - 8 > 1 ? 's' : ''}</p>}
              </div>
            )}
            <p className="font-body text-xs text-[var(--color-text-secondary)]">
              L’écart (compté moins attendu au démarrage) s’ajoute au stock du moment : les ventes faites pendant le comptage ne sont pas effacées.
            </p>
          </Sheet>
        )}
        {dialog === 'cancel' && (
          <Sheet
            title="Annuler l’inventaire ?"
            description="Les quantités saisies sont abandonnées. Le stock n’est pas modifié."
            onClose={() => setDialog(null)}
            footer={
              <>
                <button type="button" data-autofocus onClick={() => setDialog(null)} className={ghostBtn + ' flex-1'}>Continuer le comptage</button>
                <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className={primaryBtn + ' flex-1'}>
                  {cancel.isPending ? 'Annulation…' : 'Annuler l’inventaire'}
                </button>
              </>
            }
          >
            <p className="font-body text-sm">{summary.counted} ligne{summary.counted > 1 ? 's' : ''} comptée{summary.counted > 1 ? 's' : ''} sur {summary.total} seront abandonnées.</p>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="font-body text-sm text-[var(--color-text-secondary)]">
        {label}
        {unit && <span className="max-sm:sr-only"> ({unit})</span>}
      </p>
      <p className="tabular font-display text-2xl font-bold">{value}</p>
    </div>
  )
}

// Quantité comptée : Entrée ou sortie du champ enregistre, Entrée passe au suivant
function CountField({ line, editable, onCommit }: { line: InventoryLineApi; editable: boolean; onCommit: (v: number | null) => void }) {
  const counted = countedOf(line)
  const [text, setText] = useState(counted === null ? '' : String(counted).replace('.', ','))
  const [bad, setBad] = useState(false)
  // La valeur change aussi hors du champ (douchette) : on la reprend
  useEffect(() => {
    setText(counted === null ? '' : String(counted).replace('.', ','))
    setBad(false)
  }, [counted])

  if (!editable) {
    return <span className="tabular font-body text-[15px] font-medium">{counted === null ? 'Non compté' : `${formatQty(counted)} ${line.unit}`}</span>
  }

  const commit = () => {
    if (text.trim() === '') {
      if (counted !== null) onCommit(null)
      setBad(false)
      return
    }
    const v = parseQty(text)
    if (v === null) {
      setBad(true)
      return
    }
    setBad(false)
    if (v !== counted) onCommit(v)
  }

  return (
    <span className="inline-flex items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`cnt-${line.id}`}>Quantité comptée pour {line.name}</label>
      <input
        id={`cnt-${line.id}`}
        data-line={line.id}
        data-count-input
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder="-"
        aria-invalid={bad}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          commit()
          const all = [...document.querySelectorAll<HTMLInputElement>('[data-count-input]')]
          const next = all[all.indexOf(e.currentTarget) + 1]
          if (next) next.focus()
          else document.getElementById('inv-scan')?.focus()
        }}
        className={`tabular h-11 w-24 rounded-[var(--radius-md)] border bg-[var(--color-bg-surface)] px-2.5 text-right font-body text-base ${bad ? 'border-[var(--color-text-primary)] border-2' : 'border-[var(--color-border-strong)]'}`}
      />
      <span className="w-10 text-left font-body text-sm text-[var(--color-text-secondary)]">{line.unit}</span>
      {bad && <span className="sr-only" role="alert">Quantité invalide pour {line.name}</span>}
    </span>
  )
}

function GapCell({ line }: { line: InventoryLineApi }) {
  const g = lineGap(line)
  if (g === null) return <span className="font-body text-sm text-[var(--color-text-secondary)]">À compter</span>
  if (g === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-body text-sm text-[var(--color-text-secondary)]">
        <CheckCircle size={14} aria-hidden /> Aucun écart
      </span>
    )
  }
  return (
    <span className="tabular inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2.5 py-0.5 font-body text-sm font-semibold text-[var(--color-text-inverse)]">
      <span className="sr-only">{g > 0 ? 'Surplus de ' : 'Manque de '}</span>
      {formatGap(g)}
    </span>
  )
}

function ReasonCell({ line, editable, onChange }: { line: InventoryLineApi; editable: boolean; onChange: (c: CorrectionReason | '') => void }) {
  const g = lineGap(line)
  if (g === null || g === 0) return <span aria-hidden className="text-[var(--color-text-muted)]">{editable ? '' : '-'}</span>
  const label = CORRECTION_REASONS.find((r) => r.code === line.reasonCode)?.label
  if (!editable) return <span className="font-body text-sm">{label ?? 'Sans motif'}</span>
  return (
    <>
      <label className="sr-only" htmlFor={`why-${line.id}`}>Motif de l’écart pour {line.name}</label>
      <select
        id={`why-${line.id}`}
        value={line.reasonCode ?? ''}
        onChange={(e) => onChange(e.target.value as CorrectionReason | '')}
        className="h-11 w-full min-w-36 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 font-body text-sm"
      >
        <option value="">Motif (facultatif)</option>
        {CORRECTION_REASONS.map((r) => (
          <option key={r.code} value={r.code}>{r.label}</option>
        ))}
      </select>
    </>
  )
}
