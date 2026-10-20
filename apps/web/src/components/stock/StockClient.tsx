'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle,
  MagnifyingGlass,
  Package,
  PencilSimple,
  Scales,
  Warning,
  X,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { stockApi, type StockItemApi } from '@/lib/api/stock'
import { useAuthStore } from '@/stores/auth.store'
import { FieldError } from '@/components/ui/FieldError'
import { StockActionSheet, type StockAction } from './StockActionSheet'
import { MOVEMENT_LABELS, formatQty, isLow, itemLabel, matchesQuery, movementEffect, formatGap } from './stock-format'

type Tab = 'stock' | 'movements'

const UNITS = ['unité', 'kg', 'g', 'L', 'cl', 'bouteille', 'pot', 'carton']

const actionBtn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2.5 font-body text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)] active:scale-[0.97] max-md:min-h-11 max-md:px-3'

// Sous le seuil : un libellé et une icône, jamais la couleur seule
function LowBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2 py-0.5 font-body text-xs font-semibold text-[var(--color-text-inverse)]">
      <Warning size={12} weight="fill" aria-hidden /> Bas
    </span>
  )
}

function StateCell({ item }: { item: StockItemApi }) {
  if (isLow(item)) return <LowBadge />
  if (item.alertAt === null) return <span className="font-body text-sm text-[var(--color-text-secondary)]">Sans seuil</span>
  return (
    <span className="inline-flex items-center gap-1 font-body text-sm text-[var(--color-text-secondary)]">
      <CheckCircle size={14} aria-hidden /> Suffisant
    </span>
  )
}

// Seuil d'alerte et unité, modifiables sur place
function ThresholdCell({
  item, siteId, canEdit, editing, onEdit,
}: { item: StockItemApi; siteId: string; canEdit: boolean; editing: boolean; onEdit: (on: boolean) => void }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(item.alertAt === null ? '' : String(item.alertAt).replace('.', ','))
  const [unit, setUnit] = useState(item.unit)
  const [error, setError] = useState<string | null>(null)
  const label = itemLabel(item)

  const save = useMutation({
    mutationFn: () => {
      const raw = value.trim().replace(',', '.')
      let alertAt: number | null = null
      if (raw !== '') {
        if (!/^\d+(\.\d{1,3})?$/.test(raw)) throw new Error('Seuil : un nombre positif, 3 décimales au plus')
        alertAt = Number(raw)
      }
      const nextUnit = unit.trim()
      if (!item.variantId && !nextUnit) throw new Error('Indiquez une unité')
      return stockApi.updateItem(siteId, item.productId, {
        variantId: item.variantId ?? undefined,
        alertAt,
        ...(item.variantId ? {} : { unit: nextUnit }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-inventory', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-alerts', siteId] })
      toast.success(value.trim() === '' ? `Seuil retiré pour ${label}` : `Seuil enregistré pour ${label}`)
      onEdit(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (!editing) {
    const text = item.alertAt === null ? 'Définir un seuil' : `Seuil : ${formatQty(item.alertAt)} ${item.unit}`
    if (!canEdit) return <span className="tabular font-body text-sm text-[var(--color-text-secondary)]">{item.alertAt === null ? 'Aucun seuil' : text}</span>
    return (
      <button
        type="button"
        onClick={() => {
          setValue(item.alertAt === null ? '' : String(item.alertAt).replace('.', ','))
          setUnit(item.unit)
          setError(null)
          onEdit(true)
        }}
        aria-label={`${item.alertAt === null ? 'Définir' : 'Modifier'} le seuil d'alerte de ${label}`}
        className="group inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-2 -mx-2 font-body text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] max-md:min-h-11"
      >
        <span className="tabular">{text}</span>
        <PencilSimple size={14} aria-hidden className="shrink-0 opacity-60 group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        save.mutate()
      }}
      onKeyDown={(e) => e.key === 'Escape' && onEdit(false)}
      className="space-y-1.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`thr-${item.id}`}>Seuil d'alerte de {label}</label>
        <input
          id={`thr-${item.id}`}
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Seuil"
          autoComplete="off"
          className="tabular h-10 w-20 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2.5 font-body text-sm"
        />
        {!item.variantId && (
          <>
            <label className="sr-only" htmlFor={`unit-${item.id}`}>Unité de {label}</label>
            <input
              id={`unit-${item.id}`}
              list="stock-units"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unité"
              maxLength={20}
              autoComplete="off"
              className="h-10 w-20 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-2.5 font-body text-sm"
            />
          </>
        )}
        <button
          type="submit"
          disabled={save.isPending}
          aria-label="Enregistrer le seuil"
          className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          <Check size={16} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onEdit(false)}
          aria-label="Annuler la modification du seuil"
          className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-strong)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <p className="font-body text-xs text-[var(--color-text-secondary)]">Laissez vide pour ne pas être alerté.</p>
      {error && <FieldError>{error}</FieldError>}
    </form>
  )
}

function Actions({ item, canEdit, onAction }: { item: StockItemApi; canEdit: boolean; onAction: (a: StockAction) => void }) {
  if (!canEdit) return null
  const label = itemLabel(item)
  const tracked = item.product.tracking !== 'NONE'
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tracked ? (
        <Link href="/stock/lots" className={actionBtn} aria-label={`Réceptionner un lot de ${label}`}>
          <ArrowDown size={14} aria-hidden /> Réceptionner
        </Link>
      ) : (
        <button type="button" onClick={() => onAction('receive')} className={actionBtn} aria-label={`Réceptionner ${label}`}>
          <ArrowDown size={14} aria-hidden /> Réceptionner
        </button>
      )}
      <button type="button" onClick={() => onAction('correct')} className={actionBtn} aria-label={`Corriger le stock de ${label}`}>
        <Scales size={14} aria-hidden /> Corriger
      </button>
      <button type="button" onClick={() => onAction('loss')} className={actionBtn} aria-label={`Déclarer une perte sur ${label}`}>
        <ArrowUp size={14} aria-hidden /> Perte
      </button>
    </div>
  )
}

interface StockClientProps { siteId: string }

export function StockClient({ siteId }: StockClientProps) {
  const [tab, setTab] = useState<Tab>('stock')
  const [query, setQuery] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [sheet, setSheet] = useState<{ item: StockItemApi; action: StockAction } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const role = useAuthStore((s) => s.user?.role)
  // Un vendeur consulte le stock ; seuls le titulaire et le gérant le modifient
  const canEdit = role === 'OWNER' || role === 'MANAGER'

  const { data: inventory = [], isLoading: loadInv } = useQuery({
    queryKey: ['stock-inventory', siteId],
    queryFn: () => stockApi.getInventory(siteId),
  })

  const { data: movements = [], isLoading: loadMov } = useQuery({
    queryKey: ['stock-movements', siteId],
    queryFn: () => stockApi.getMovements(siteId),
    enabled: tab === 'movements',
  })

  const lowCount = useMemo(() => inventory.filter(isLow).length, [inventory])
  const visible = useMemo(
    () => inventory.filter((i) => (!onlyLow || isLow(i)) && matchesQuery(i, query)),
    [inventory, onlyLow, query],
  )
  const names = useMemo(() => {
    const map = new Map<string, StockItemApi>()
    for (const i of inventory) map.set(`${i.productId}:${i.variantId ?? ''}`, i)
    return map
  }, [inventory])

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'stock', label: 'En stock' },
    { key: 'movements', label: 'Mouvements' },
  ]

  return (
    <div className="flex h-full flex-col">
      <datalist id="stock-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
        <div>
          <h1 className="page-title">Stock</h1>
          <p className="mt-0.5 flex items-center gap-1.5 font-body text-sm text-[var(--color-text-secondary)]" aria-live="polite">
            {lowCount > 0 ? (
              <>
                <Warning size={14} weight="fill" aria-hidden className="shrink-0 text-[var(--color-text-primary)]" />
                <span>
                  <strong className="font-semibold text-[var(--color-text-primary)]">{lowCount} produit{lowCount > 1 ? 's' : ''}</strong> au seuil d'alerte ou en dessous
                </span>
              </>
            ) : (
              <span>{inventory.length ? 'Aucun produit sous son seuil d’alerte' : ' '}</span>
            )}
          </p>
        </div>
        {!canEdit && (
          <p className="font-body text-sm text-[var(--color-text-secondary)]">Consultation seule : le titulaire et le gérant modifient le stock.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:px-6">
        <div role="group" aria-label="Vue du stock" className="flex gap-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className={[
                'min-h-10 rounded-[var(--radius-md)] px-3 font-body text-sm transition-colors',
                tab === key
                  ? 'bg-[var(--color-bg-elevated)] font-semibold text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'stock' && (
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <label htmlFor="stock-search" className="sr-only">Chercher un produit, un SKU ou un code-barres</label>
              <input
                id="stock-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, SKU ou code-barres"
                autoComplete="off"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-9 pr-3 font-body text-sm"
              />
            </div>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3.5 font-body text-sm text-[var(--color-text-secondary)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)] has-[:checked]:font-semibold has-[:checked]:text-[var(--color-text-primary)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]">
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="sr-only" />
              <Warning size={14} weight={onlyLow ? 'fill' : 'regular'} aria-hidden />
              Stock bas{lowCount > 0 ? ` (${lowCount})` : ''}
            </label>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {tab === 'stock' && (
          loadInv ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-1 h-14 animate-pulse rounded border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
            ))
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Package size={32} aria-hidden className="text-[var(--color-text-secondary)]" />
              <p className="font-body text-sm text-[var(--color-text-secondary)]">
                {inventory.length === 0
                  ? 'Aucun stock suivi. Réceptionnez un produit ou démarrez un inventaire.'
                  : onlyLow && !query
                    ? 'Aucun produit sous son seuil d’alerte.'
                    : 'Aucun produit ne correspond à cette recherche.'}
              </p>
              {inventory.length === 0 && (
                <Link href="/stock/inventaire" className="font-body text-sm font-semibold text-[var(--color-accent)] hover:underline">Démarrer un inventaire</Link>
              )}
            </div>
          ) : (
            <>
              {/* Écran large : tableau */}
              <table className="hidden w-full table-fixed border-collapse md:table">
                <caption className="sr-only">Stock par produit : quantité, seuil d’alerte, état et actions</caption>
                <colgroup>
                  <col />
                  <col className="w-[100px]" />
                  <col className="w-[250px]" />
                  <col className="w-[112px]" />
                  {canEdit && <col className="w-[350px]" />}
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--color-border-strong)] text-left font-body text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    <th scope="col" className="py-2 pr-3 font-medium">Produit</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">En stock</th>
                    <th scope="col" className="px-3 py-2 font-medium">Seuil d’alerte</th>
                    <th scope="col" className="px-3 py-2 font-medium">État</th>
                    {canEdit && <th scope="col" className="py-2 pl-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)] align-middle">
                      <th scope="row" className="py-3 pr-3 text-left font-normal">
                        <span className="block truncate font-body text-[15px] font-medium text-[var(--color-text-primary)]">{itemLabel(item)}</span>
                        {(item.product.sku || item.product.barcode) && (
                          <span className="block truncate font-data text-xs text-[var(--color-text-secondary)]">{item.product.sku ?? item.product.barcode}</span>
                        )}
                      </th>
                      <td className="tabular whitespace-nowrap px-3 py-3 text-right font-body text-[15px] font-medium">
                        {formatQty(item.quantity)} <span className="font-normal text-[var(--color-text-secondary)]">{item.unit}</span>
                      </td>
                      <td className="px-3 py-3">
                        <ThresholdCell item={item} siteId={siteId} canEdit={canEdit} editing={editing === item.id} onEdit={(on) => setEditing(on ? item.id : null)} />
                      </td>
                      <td className="px-3 py-3"><StateCell item={item} /></td>
                      {canEdit && (
                        <td className="py-3 pl-3"><Actions item={item} canEdit={canEdit} onAction={(action) => setSheet({ item, action })} /></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Téléphone : une carte par produit */}
              <ul className="space-y-3 md:hidden">
                {visible.map((item) => (
                  <li key={item.id} className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-body text-[15px] font-medium text-[var(--color-text-primary)]">{itemLabel(item)}</p>
                        {(item.product.sku || item.product.barcode) && (
                          <p className="font-data text-xs text-[var(--color-text-secondary)]">{item.product.sku ?? item.product.barcode}</p>
                        )}
                      </div>
                      <p className="tabular shrink-0 text-right font-body text-lg font-semibold">
                        {formatQty(item.quantity)} <span className="text-sm font-normal text-[var(--color-text-secondary)]">{item.unit}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ThresholdCell item={item} siteId={siteId} canEdit={canEdit} editing={editing === item.id} onEdit={(on) => setEditing(on ? item.id : null)} />
                      <StateCell item={item} />
                    </div>
                    <Actions item={item} canEdit={canEdit} onAction={(action) => setSheet({ item, action })} />
                  </li>
                ))}
              </ul>
            </>
          )
        )}

        {tab === 'movements' && (
          loadMov ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mb-1 h-12 animate-pulse rounded bg-[var(--color-bg-surface)]" />
            ))
          ) : movements.length === 0 ? (
            <p className="py-16 text-center font-body text-sm text-[var(--color-text-secondary)]">Aucun mouvement pour l’instant.</p>
          ) : (
            <ul>
              {movements.map((m) => {
                const known = names.get(`${m.productId}:${m.variantId ?? ''}`)
                const effect = movementEffect(m.type, m.quantity)
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-24 shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] px-2 py-1 text-center font-body text-xs font-medium text-[var(--color-text-secondary)]">
                        {MOVEMENT_LABELS[m.type]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm text-[var(--color-text-primary)]">{known ? itemLabel(known) : 'Produit retiré du suivi'}</p>
                        {m.reason && <p className="truncate font-body text-sm text-[var(--color-text-secondary)]">{m.reason}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="tabular font-body text-sm font-semibold">
                        <span className="sr-only">{effect < 0 ? 'Sortie de ' : 'Entrée de '}</span>
                        {formatGap(effect)}
                      </span>
                      <span className="tabular hidden font-body text-xs text-[var(--color-text-secondary)] sm:block">
                        {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>

      <AnimatePresence>
        {sheet && (
          <StockActionSheet key={`${sheet.item.id}:${sheet.action}`} siteId={siteId} item={sheet.item} action={sheet.action} onClose={() => setSheet(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
