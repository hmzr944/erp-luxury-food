'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supplyApi, type CatalogItem } from '@/lib/api/supply'

// Ce que le labo propose aux boutiques, avec son prix de cession interne
export function LaboCatalog({ siteId }: { siteId: string }) {
  const catalog = useQuery({ queryKey: ['supply', siteId, 'catalog'], queryFn: () => supplyApi.catalog(siteId) })
  if (!catalog.data) return <p className="py-6 text-sm text-[var(--color-text-secondary)]">{catalog.isError ? (catalog.error as Error).message : 'Chargement...'}</p>
  if (!catalog.data.length) {
    return <p className="py-6 text-[15px] text-[var(--color-text-secondary)]">Ajoutez d&apos;abord les produits de ce site dans le Catalogue.</p>
  }
  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-[15px] text-[var(--color-text-secondary)]">
        Cochez ce que les boutiques peuvent commander. À la réception, le stock d&apos;une boutique est crédité sur le produit qui porte la même
        référence, le même code-barres ou le même nom.
      </p>
      <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        {catalog.data.map((p) => (
          <CatalogRow key={p.id} siteId={siteId} item={p} />
        ))}
      </ul>
    </div>
  )
}

function CatalogRow({ siteId, item }: { siteId: string; item: CatalogItem }) {
  const qc = useQueryClient()
  const [price, setPrice] = useState(item.supplyPrice != null ? String(item.supplyPrice).replace('.', ',') : '')
  const [unit, setUnit] = useState(item.supplyUnit ?? '')
  const save = async (body: Parameters<typeof supplyApi.updateCatalog>[2]) => {
    try {
      await supplyApi.updateCatalog(siteId, item.id, body)
      await qc.invalidateQueries({ queryKey: ['supply', siteId, 'catalog'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const field =
    'h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 text-[15px] focus:border-[var(--color-accent)] focus:outline-none'
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <label className="flex min-h-11 min-w-0 flex-1 basis-60 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={item.orderable} onChange={(e) => save({ orderable: e.target.checked })} className="size-5 shrink-0 accent-[var(--color-accent)]" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium">{item.name}</span>
          {item.variants.length > 0 && <span className="block truncate text-sm text-[var(--color-text-secondary)]">{item.variants.map((v) => v.name).join(', ')}</span>}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        Cession
        <input
          inputMode="decimal"
          placeholder="0,00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const n = price.trim() ? Number(price.replace(',', '.')) : null
            if (n === null || (Number.isFinite(n) && n >= 0)) void save({ supplyPrice: n })
          }}
          className={field + ' tabular w-24 text-right'}
        />
        €
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        par
        <input
          placeholder="pièce"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onBlur={() => save({ supplyUnit: unit })}
          className={field + ' w-28'}
        />
      </label>
    </li>
  )
}
