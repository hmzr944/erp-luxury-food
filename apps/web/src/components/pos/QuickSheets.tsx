'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatPrice } from '@erp/utils'
import { productsApi, type ApiCategory, type ApiProduct, type ProductSuggestion } from '@/lib/api/products'
import { productsAdminApi } from '@/lib/api/products-admin'
import type { PlatformConfig } from '@/lib/api/platform'
import { Sheet } from './Sheet'

const fieldCls =
  'h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-base focus:border-[var(--color-accent)] focus:outline-none'

const parseAmount = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function TaxChoice({ rates, value, onChange }: { rates: PlatformConfig['taxRates']; value: number; onChange: (r: number) => void }) {
  if (rates.length <= 1) return null
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">TVA</legend>
      <div className="flex flex-wrap gap-2">
        {rates.map((t) => {
          const rate = Number(t.rate)
          const active = rate === value
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(rate)}
              className={[
                'h-11 rounded-[var(--radius-pill)] px-4 text-sm font-medium',
                active ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)]' : 'border border-[var(--color-border-strong)]',
              ].join(' ')}
            >
              {String(rate).replace('.', ',')} %
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// « Nutella » + « Nutella » + « 400 g ℮ » → « Nutella 400 g »
export function suggestedName(s: ProductSuggestion): string {
  const brand = s.brand && !s.name.toLowerCase().includes(s.brand.toLowerCase()) ? s.brand : undefined
  const quantity = s.quantity?.replace(/\s*(℮|e)$/u, '').trim()
  return [brand, s.name, quantity].filter(Boolean).join(' ')
}

const defaultRate = (config?: PlatformConfig) => Number(config?.taxRates.find((t) => t.isDefault)?.rate ?? 20)

// Article libre : vendre tout de suite ce qui n'est pas au catalogue
export function CustomItemSheet({
  open,
  config,
  onClose,
  onAdd,
}: {
  open: boolean
  config?: PlatformConfig
  onClose: () => void
  onAdd: (item: { name: string; price: number; taxRate: number }) => void
}) {
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [rate, setRate] = useState(defaultRate(config))
  const price = parseAmount(amount)

  useEffect(() => {
    if (open) {
      setAmount('')
      setName('')
      setRate(defaultRate(config))
    }
  }, [open, config])

  return (
    <Sheet open={open} title="Article libre" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (price) onAdd({ name: name.trim() || 'Article libre', price, taxRate: rate })
        }}
      >
        <div className="space-y-2">
          <label htmlFor="custom-amount" className="block text-sm font-medium">
            Prix
          </label>
          <input
            id="custom-amount"
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldCls + ' tabular h-16 text-3xl font-semibold'}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="custom-name" className="block text-sm font-medium">
            Nom (facultatif)
          </label>
          <input id="custom-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
        </div>
        <TaxChoice rates={config?.taxRates ?? []} value={rate} onChange={setRate} />
        <button
          type="submit"
          disabled={!price}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
        >
          {price ? `Ajouter ${formatPrice(price)}` : 'Ajouter'}
        </button>
      </form>
    </Sheet>
  )
}

// Nouveau produit depuis la caisse : code-barres scanné ou nom cherché
export function QuickProductSheet({
  siteId,
  seed,
  config,
  categories,
  onClose,
  onCreated,
}: {
  siteId: string
  seed: string | null // code-barres ou nom saisi
  config?: PlatformConfig
  categories: ApiCategory[]
  onClose: () => void
  onCreated: (product: ApiProduct) => void
}) {
  const qc = useQueryClient()
  const barcode = seed && /^\d{8,14}$/.test(seed) ? seed : undefined
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(defaultRate(config))
  const [categoryId, setCategoryId] = useState('')
  const [suggestion, setSuggestion] = useState<ProductSuggestion | null>(null)
  const [looking, setLooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const price = parseAmount(amount)

  useEffect(() => {
    if (!seed) return
    setName(barcode ? '' : seed)
    setAmount('')
    setRate(defaultRate(config))
    setCategoryId('')
    setSuggestion(null)
    setError(null)
    if (!barcode) return
    if (!navigator.onLine) return setError('Hors ligne : saisissez la fiche à la main.')
    setLooking(true)
    productsApi
      .lookup(siteId, barcode)
      .then((r) => {
        if (r.suggestion) {
          setSuggestion(r.suggestion)
          setName(suggestedName(r.suggestion))
        }
      })
      .catch(() => {})
      .finally(() => setLooking(false))
  }, [seed, barcode, siteId, config])

  const save = async () => {
    if (!price || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const product = await productsAdminApi.create(siteId, {
        name: name.trim(),
        price,
        taxRate: rate,
        ...(barcode ? { barcode } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(suggestion?.imageUrl ? { imageUrl: suggestion.imageUrl } : {}),
      })
      await qc.invalidateQueries({ queryKey: ['products', siteId] })
      onCreated(product)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={!!seed} title="Nouveau produit" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {barcode && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Code-barres <span className="font-data">{barcode}</span>
            {looking ? ', recherche de la fiche...' : suggestion ? `, fiche trouvée dans ${suggestion.source} : vérifiez-la.` : ''}
          </p>
        )}
        <div className="flex gap-4">
          {suggestion?.imageUrl && (
            // Image proposée par la base ouverte, affichée telle quelle
            <img src={suggestion.imageUrl} alt="" className="size-20 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] object-contain" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="qp-name" className="block text-sm font-medium">
              Nom
            </label>
            <input id="qp-name" required value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="qp-price" className="block text-sm font-medium">
            Prix de vente
          </label>
          <input
            id="qp-price"
            data-autofocus
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldCls + ' tabular text-xl font-semibold'}
          />
        </div>
        <TaxChoice rates={config?.taxRates ?? []} value={rate} onChange={setRate} />
        {categories.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="qp-cat" className="block text-sm font-medium">
              Catégorie
            </label>
            <select id="qp-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-accent-muted)] p-3 text-sm font-medium">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!price || !name.trim() || saving}
          className="h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)]"
        >
          {saving ? 'Enregistrement...' : 'Créer et ajouter à la vente'}
        </button>
      </form>
    </Sheet>
  )
}
