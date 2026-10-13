'use client'

import { useState } from 'react'
import { formatPrice } from '@erp/utils'
import type { ApiProduct, ApiVariant } from '@/lib/api/products'
import { Sheet } from './Sheet'

interface VariantPickerProps {
  product: ApiProduct | null
  onClose: () => void
  onChoose: (product: ApiProduct, variant?: ApiVariant, serialNumber?: string) => void
}

// Choix en un geste : chaque case de la grille ajoute directement la variante
export function VariantPicker({ product, onClose, onChoose }: VariantPickerProps) {
  return (
    <Sheet open={!!product} title={product?.name ?? ''} onClose={onClose} width="lg">
      {product && <PickerBody key={product.id} product={product} onChoose={onChoose} />}
    </Sheet>
  )
}

function PickerBody({ product, onChoose }: { product: ApiProduct; onChoose: VariantPickerProps['onChoose'] }) {
  const needsSerial = product.tracking === 'SERIAL'
  const [pending, setPending] = useState<ApiVariant | null | undefined>(needsSerial && !product.variants.length ? null : undefined)

  if (pending !== undefined) {
    return (
      <SerialStep
        label={pending ? `${product.name} ${pending.name}` : product.name}
        onConfirm={(serial) => onChoose(product, pending ?? undefined, serial)}
      />
    )
  }

  const pick = (v: ApiVariant) => (needsSerial ? setPending(v) : onChoose(product, v))
  const axes = [...product.options].sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-4">
      {product.subtitle && <p className="-mt-1 text-sm text-[var(--color-text-secondary)]">{product.subtitle}</p>}
      {axes.length === 2 ? (
        <Matrix product={product} rows={axes[0]} cols={axes[1]} onPick={pick} />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {product.variants.map((v) => (
            <li key={v.id}>
              <VariantButton variant={v} label={v.name} showPrice={hasPriceSpread(product)} onPick={() => pick(v)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Matrix({
  product,
  rows,
  cols,
  onPick,
}: {
  product: ApiProduct
  rows: ApiProduct['options'][number]
  cols: ApiProduct['options'][number]
  onPick: (v: ApiVariant) => void
}) {
  const find = (r: string, c: string) =>
    product.variants.find((v) => v.options?.[rows.name] === r && v.options?.[cols.name] === c)
  const showPrice = hasPriceSpread(product)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-2 -mx-2">
        <caption className="sr-only">
          {rows.name} et {cols.name}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-16 text-left text-xs font-medium text-[var(--color-text-muted)]">
              <span className="sr-only">{rows.name}</span>
            </th>
            {cols.values.map((c) => (
              <th key={c} scope="col" className="text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.values.map((r) => (
            <tr key={r}>
              <th scope="row" className="text-left text-base font-semibold">
                {r}
              </th>
              {cols.values.map((c) => {
                const v = find(r, c)
                return (
                  <td key={c}>
                    {v ? (
                      <VariantButton variant={v} label={`${r} ${c}`} compact showPrice={showPrice} onPick={() => onPick(v)} />
                    ) : (
                      <span className="block h-14 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)]" aria-label="Non proposé" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VariantButton({
  variant,
  label,
  compact,
  showPrice,
  onPick,
}: {
  variant: ApiVariant
  label: string
  compact?: boolean
  showPrice: boolean
  onPick: () => void
}) {
  const stock = variant.stock ? Number(variant.stock.quantity) : null
  const out = stock !== null && stock <= 0
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${label}${stock !== null ? `, ${stock} en stock` : ''}`}
      className={[
        'flex w-full flex-col justify-center rounded-[var(--radius-md)] border px-3 text-left transition-[transform,border-color] duration-150 active:scale-[0.97]',
        compact ? 'h-14' : 'min-h-14 py-2',
        out
          ? 'border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)]'
          : 'border-[var(--color-border-strong)] hover:border-[var(--color-accent)]',
      ].join(' ')}
    >
      {!compact && <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">{label}</span>}
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="tabular">{stock === null ? '' : out ? 'Épuisé' : `${stock} en stock`}</span>
        {showPrice && <span className="tabular text-[var(--color-text-secondary)]">{formatPrice(Number(variant.price))}</span>}
      </span>
    </button>
  )
}

function SerialStep({ label, onConfirm }: { label: string; onConfirm: (serial: string) => void }) {
  const [serial, setSerial] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (serial.trim()) onConfirm(serial.trim())
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <label htmlFor="serial" className="block text-sm font-medium">
          Numéro de série de la pièce
        </label>
        <input
          id="serial"
          data-autofocus
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          autoComplete="off"
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 font-data text-base focus:border-[var(--color-accent)] focus:outline-none"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">{label}. Gravé ou inscrit sur le certificat.</p>
      </div>
      <button
        type="submit"
        disabled={!serial.trim()}
        className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-base font-semibold text-[var(--color-on-accent)] disabled:opacity-40"
      >
        Ajouter
      </button>
    </form>
  )
}

function hasPriceSpread(product: ApiProduct) {
  const prices = new Set(product.variants.map((v) => Number(v.price)))
  return prices.size > 1
}
