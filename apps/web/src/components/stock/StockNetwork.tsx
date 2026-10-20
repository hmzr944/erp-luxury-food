'use client'

import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowsDownUp, CaretLeft, CaretRight, MagnifyingGlass, Package, Warning, WarningCircle } from '@phosphor-icons/react'
import {
  ariaSort, formatQty, nextSort, stockNetworkApi,
  type NetworkSite, type NetworkSort, type NetworkStock, type NetworkStockRow,
} from './network'

const chip =
  'relative flex h-10 cursor-pointer items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3.5 font-body text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)] has-[:checked]:font-medium has-[:checked]:text-[var(--color-accent)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]'

// Sous le seuil : un libellé et une icône, jamais la couleur seule
function LowBadge({ detail }: { detail?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2 py-0.5 font-body text-xs font-semibold text-[var(--color-text-inverse)]">
      <Warning size={12} weight="fill" aria-hidden /> Bas
      {detail && <span className="sr-only">{detail}</span>}
    </span>
  )
}

function SiteCell({ row, siteId, siteName }: { row: NetworkStockRow; siteId: string; siteName: string }) {
  const s = row.sites.find((x) => x.siteId === siteId)
  if (!s) return <span className="text-sm text-[var(--color-text-secondary)]">Non suivi<span className="sr-only"> à {siteName}</span></span>
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <span className="tabular text-sm font-medium">{formatQty(s.quantity)}</span>
      {s.low && <LowBadge detail={` : sous le seuil d'alerte de ${formatQty(s.alertAt ?? 0)}`} />}
    </span>
  )
}

function lowSummary(row: NetworkStockRow, sites: NetworkSite[]): string {
  const names = row.lowSiteIds.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean)
  return names.join(', ')
}

function ProductName({ row }: { row: NetworkStockRow }) {
  return (
    <>
      <span className="block truncate text-[15px] font-medium">
        {row.name}
        {row.variantName && <span className="font-normal text-[var(--color-text-secondary)]">{`, ${row.variantName}`}</span>}
      </span>
      {(row.sku || row.barcode) && <span className="block truncate font-data text-xs text-[var(--color-text-secondary)]">{row.sku ?? row.barcode}</span>}
    </>
  )
}

function SortHeader({
  label, column, state, onSort, align = 'left',
}: { label: string; column: NetworkSort; state: { sort: NetworkSort; order: 'asc' | 'desc' }; onSort: (c: NetworkSort) => void; align?: 'left' | 'right' }) {
  const active = state.sort === column
  const Icon = !active ? ArrowsDownUp : state.order === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={ariaSort(state, column)} className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-sm)] px-1 hover:text-[var(--color-text-primary)] ${active ? 'text-[var(--color-text-primary)]' : ''}`}
      >
        {label}
        <Icon size={13} weight={active ? 'bold' : 'regular'} aria-hidden />
      </button>
    </th>
  )
}

function Results({ data, sort, onSort }: { data: NetworkStock; sort: { sort: NetworkSort; order: 'asc' | 'desc' }; onSort: (c: NetworkSort) => void }) {
  return (
    <>
      {/* Mobile : une fiche par produit, les boutiques en liste de définitions */}
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] md:hidden">
        {data.rows.map((row) => (
          <li key={row.key} className="px-4 py-3 font-body">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><ProductName row={row} /></div>
              <p className="tabular shrink-0 text-right font-display text-lg font-semibold">
                {formatQty(row.total)} <span className="font-body text-xs font-normal text-[var(--color-text-secondary)]">{row.unit}</span>
                <span className="sr-only"> au total</span>
              </p>
            </div>
            {row.lowSiteIds.length > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                <LowBadge /> <span className="min-w-0 truncate">Sous le seuil : {lowSummary(row, data.sites)}</span>
              </p>
            )}
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
              {data.sites.map((s) => (
                <div key={s.id} className="contents">
                  <dt className="truncate text-[var(--color-text-secondary)]">{s.name}</dt>
                  <dd className="text-right"><SiteCell row={row} siteId={s.id} siteName={s.name} /></dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {/* Ordinateur : un tableau, une colonne par boutique. Seul le tableau défile s'il y a beaucoup de boutiques */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] md:block" tabIndex={0} role="region" aria-label="Stock par boutique">
        <table className="w-full min-w-max border-collapse font-body">
          <caption className="sr-only">Stock de chaque produit dans chaque boutique, total du réseau et boutiques sous leur seuil d&apos;alerte</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
              <SortHeader label="Produit" column="name" state={sort} onSort={onSort} />
              {data.sites.map((s) => (
                <th key={s.id} scope="col" className="max-w-40 truncate px-3 py-2 text-right font-medium">{s.name}</th>
              ))}
              <SortHeader label="Total" column="total" state={sort} onSort={onSort} align="right" />
              <SortHeader label="Sous le seuil" column="low" state={sort} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="max-w-72 min-w-48 px-3 py-3 text-left font-normal"><ProductName row={row} /></th>
                {data.sites.map((s) => (
                  <td key={s.id} className="px-3 py-3 text-right"><SiteCell row={row} siteId={s.id} siteName={s.name} /></td>
                ))}
                <td className="tabular px-3 py-3 text-right font-display text-base font-semibold">
                  {formatQty(row.total)} <span className="font-body text-xs font-normal text-[var(--color-text-secondary)]">{row.unit}</span>
                </td>
                <td className="px-3 py-3 text-right text-sm">
                  {row.lowSiteIds.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LowBadge />
                      <span>{row.lowSiteIds.length} boutique{row.lowSiteIds.length > 1 ? 's' : ''}<span className="sr-only"> : {lowSummary(row, data.sites)}</span></span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">Aucune</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function StockNetwork() {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [siteIds, setSiteIds] = useState<string[]>([])
  const [lowOnly, setLowOnly] = useState(false)
  const [sort, setSort] = useState<{ sort: NetworkSort; order: 'asc' | 'desc' }>({ sort: 'name', order: 'asc' })
  const [page, setPage] = useState(1)

  // La recherche part une fois la saisie posée
  useEffect(() => {
    const t = setTimeout(() => { setQ(input); setPage(1) }, 250)
    return () => clearTimeout(t)
  }, [input])

  const query = { q, siteIds, lowOnly, ...sort, page }
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['stock-network', query],
    queryFn: () => stockNetworkApi.get(query),
    placeholderData: keepPreviousData,
  })
  // Les boutiques proposées au filtre restent celles du réseau, même une fois filtré
  const [allSites, setAllSites] = useState<NetworkSite[]>([])
  useEffect(() => {
    if (data && !siteIds.length) setAllSites(data.sites)
  }, [data, siteIds.length])

  const filtered = q.trim() !== '' || siteIds.length > 0 || lowOnly
  const reset = () => { setInput(''); setQ(''); setSiteIds([]); setLowOnly(false); setPage(1) }
  const toggleSite = (id: string) => { setSiteIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])); setPage(1) }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
        <div>
          <h1 className="page-title">Stock du réseau</h1>
          <p className="mt-1 font-body text-sm text-[var(--color-text-secondary)]" role="status">
            {data
              ? `${data.total} produit${data.total > 1 ? 's' : ''}${filtered ? ' trouvés' : ' rapprochés entre vos boutiques'}${data.lowCount > 0 ? `, dont ${data.lowCount} sous le seuil d'alerte dans au moins une boutique` : ''}`
              : 'Chargement du stock'}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <label htmlFor="stock-reseau-q" className="sr-only">Rechercher un produit, une référence ou un code-barres</label>
            <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              id="stock-reseau-q"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Produit, référence, code-barres"
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-9 pr-3 font-body text-sm"
            />
          </div>

          <fieldset className="min-w-0">
            <legend className="sr-only">Boutiques à afficher (toutes si aucune n&apos;est cochée)</legend>
            <div className="flex flex-wrap gap-1.5">
              {allSites.map((s) => (
                <label key={s.id} className={chip}>
                  <input type="checkbox" checked={siteIds.includes(s.id)} onChange={() => toggleSite(s.id)} className="absolute inset-0 cursor-pointer opacity-0" />
                  {s.name}
                </label>
              ))}
              <label className={chip}>
                <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }} className="absolute inset-0 cursor-pointer opacity-0" />
                <Warning size={14} aria-hidden className="mr-1.5" /> Sous le seuil seulement
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      <div className="min-w-0 space-y-4 p-4 sm:p-6" aria-busy={isFetching}>
        {isLoading ? (
          <div role="status" aria-busy="true" className="space-y-1.5">
            <span className="sr-only">Chargement du stock du réseau</span>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
            ))}
          </div>
        ) : isError && !data ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] p-5">
            <p className="flex items-center gap-2 font-body text-[15px] font-medium"><WarningCircle size={20} weight="fill" aria-hidden /> Impossible de charger le stock du réseau</p>
            <p className="font-body text-sm text-[var(--color-text-secondary)]">Vérifiez la connexion puis réessayez.</p>
            <button type="button" onClick={() => refetch()} className="h-10 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-medium text-[var(--color-on-accent)] active:scale-[0.97]">Réessayer</button>
          </div>
        ) : data && data.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Package size={32} aria-hidden className="text-[var(--color-text-secondary)]" />
            <p className="font-body text-sm text-[var(--color-text-secondary)]">
              {filtered ? 'Aucun produit ne correspond à ces filtres.' : 'Aucun produit suivi en stock dans vos boutiques.'}
            </p>
            {filtered && (
              <button type="button" onClick={reset} className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-4 font-body text-sm hover:bg-[var(--color-bg-hover)]">
                Effacer les filtres
              </button>
            )}
          </div>
        ) : data ? (
          <>
            {/* Tri au clavier sur mobile : les en-têtes de colonnes n'y sont pas affichés */}
            <div className="flex items-center gap-2 md:hidden">
              <label htmlFor="stock-reseau-tri" className="font-body text-sm text-[var(--color-text-secondary)]">Trier par</label>
              <select
                id="stock-reseau-tri"
                value={`${sort.sort}:${sort.order}`}
                onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort({ sort: s as NetworkSort, order: o as 'asc' | 'desc' }); setPage(1) }}
                className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2 font-body text-sm"
              >
                <option value="name:asc">Nom, A à Z</option>
                <option value="name:desc">Nom, Z à A</option>
                <option value="total:desc">Total, du plus au moins</option>
                <option value="total:asc">Total, du moins au plus</option>
                <option value="low:desc">Sous le seuil, d&apos;abord</option>
              </select>
            </div>

            <Results data={data} sort={sort} onSort={(c) => { setSort((cur) => nextSort(cur, c)); setPage(1) }} />

            {data.pageCount > 1 && (
              <nav aria-label="Pagination du stock" className="flex items-center justify-between gap-3 font-body text-sm">
                <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 hover:bg-[var(--color-bg-hover)] disabled:opacity-40">
                  <CaretLeft size={14} aria-hidden /> Précédent
                </button>
                <p className="tabular text-[var(--color-text-secondary)]">Page {data.page} sur {data.pageCount}</p>
                <button type="button" disabled={data.page >= data.pageCount} onClick={() => setPage(data.page + 1)} className="inline-flex h-10 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 hover:bg-[var(--color-bg-hover)] disabled:opacity-40">
                  Suivant <CaretRight size={14} aria-hidden />
                </button>
              </nav>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
