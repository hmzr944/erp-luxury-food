'use client'

import { useMemo, useRef, useState } from 'react'
import { MagnifyingGlass, Barcode, X, Plus } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { motion } from 'framer-motion'
import { rayonColors } from '@/lib/brand'
import { EASE_OUT } from '@/lib/motion'
import { useCartStore } from '@/stores/cart.store'
import type { ApiCategory, ApiProduct, ApiVariant } from '@/lib/api/products'

interface CatalogProps {
  products: ApiProduct[]
  categories: ApiCategory[]
  isLoading: boolean
  isError: boolean
  onPick: (product: ApiProduct, variant?: ApiVariant) => void
  // Vendre un article hors catalogue (nom et prix saisis)
  onCustom: () => void
  // Créer un produit à partir d'un code-barres ou d'un nom introuvable
  onCreate: (seed: string) => void
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Catalog({ products, categories, isLoading, isError, onPick, onCustom, onCreate }: CatalogProps) {
  const [category, setCategory] = useState<string | null>(null)
  // Une couleur par rayon (choisie, sinon attribuée dans l'ordre)
  const colorOf = useMemo(() => rayonColors(categories), [categories])
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    return products.filter((p) => {
      if (q) {
        const haystack = normalize([p.name, p.subtitle, p.sku, p.barcode].filter(Boolean).join(' '))
        return haystack.includes(q)
      }
      return !category || p.categoryId === category
    })
  }, [products, category, query])

  // Douchette : elle tape le code puis Entrée. On cherche dans le catalogue
  // déjà chargé, donc le scan fonctionne aussi sans réseau.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = query.trim()
    if (!code) return
    for (const p of products) {
      const variant = p.variants.find((v) => v.barcode === code)
      if (variant) return done(p, variant)
      if (p.barcode === code) return done(p)
    }
    if (visible.length === 1) return done(visible[0])
    setNotFound(code)
  }

  const done = (p: ApiProduct, v?: ApiVariant) => {
    onPick(p, v)
    setQuery('')
    setNotFound(null)
    search.current?.focus()
  }

  return (
    <section aria-label="Catalogue" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <form onSubmit={onSubmit} className="px-4 pt-4 md:px-6" role="search">
        <label htmlFor="pos-search" className="sr-only">
          Rechercher un produit ou scanner un code-barres
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={20}
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            id="pos-search"
            ref={search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setNotFound(null)
            }}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Rechercher ou scanner"
            className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] pl-12 pr-12 text-base placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setNotFound(null)
                search.current?.focus()
              }}
              aria-label="Effacer la recherche"
              className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            >
              <X size={18} />
            </button>
          ) : (
            <Barcode
              size={20}
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          )}
        </div>
        {notFound && (
          <p role="status" className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-[var(--color-text-secondary)]">
            Aucun produit pour « {notFound} ».
            <button
              type="button"
              onClick={() => {
                onCreate(notFound)
                setNotFound(null)
                setQuery('')
              }}
              className="h-11 font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              Créer ce produit
            </button>
          </p>
        )}
      </form>

      {!query && categories.length > 0 && (
        <div
          role="tablist"
          aria-label="Catégories"
          className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 md:px-6 [scrollbar-width:none]"
        >
          {[{ id: null, name: 'Tout' }, ...categories].map((c) => {
            const active = category === c.id
            const color = c.id ? colorOf.get(c.id) : undefined
            return (
              <button
                key={c.id ?? 'all'}
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c.id)}
                style={active && color ? { color: 'var(--on-gamme)' } : undefined}
                className={[
                  'relative flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-5 text-[15px] font-medium transition-colors duration-150',
                  active
                    ? color
                      ? 'font-semibold'
                      : 'text-[var(--color-bg-base)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
                ].join(' ')}
              >
                {/* La pastille du rayon actif glisse d'un rayon à l'autre et prend sa couleur */}
                {active && (
                  <motion.span
                    layoutId="rayon-actif"
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--radius-pill)]"
                    style={{ background: color ?? 'var(--color-text-primary)' }}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  />
                )}
                {color && !active && <span aria-hidden className="relative size-2.5 rounded-full" style={{ background: color }} />}
                <span className="relative">{c.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-3 md:px-6 md:pb-6">
        {isLoading ? (
          <TileSkeletons />
        ) : isError && products.length === 0 ? (
          <Empty
            title="Catalogue indisponible"
            text="La caisse n'a pas encore de copie du catalogue. Connectez-la à internet une première fois."
          />
        ) : visible.length === 0 && query ? (
          <Empty title="Aucun résultat" text="Appuyez sur Entrée pour créer ce produit, ou essayez un autre mot." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {!query && (
              <li>
                <button
                  type="button"
                  onClick={onCustom}
                  className="flex h-full min-h-[112px] w-full flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] p-4 text-left hover:border-[var(--color-accent)] press"
                >
                  <Plus size={20} aria-hidden className="text-[var(--color-accent)]" />
                  <span>
                    <span className="block text-[15px] font-semibold">Article libre</span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">Prix saisi à la main</span>
                  </span>
                </button>
              </li>
            )}
            {visible.map((p) => (
              <li key={p.id}>
                <ProductTile product={p} color={p.categoryId ? colorOf.get(p.categoryId) : undefined} onPick={() => onPick(p)} />
              </li>
            ))}
            {products.length === 0 && (
              <li className="col-span-full pt-2 text-sm text-[var(--color-text-secondary)]">
                Catalogue vide : vendez avec « Article libre », scannez un code-barres pour créer un produit, ou importez votre
                catalogue dans Paramètres, Données.
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  )
}

// La couleur du rayon teinte la tuile : on repère « Mailles » ou « Pâtisseries »
// d'un coup d'œil, le nom et le prix restent en encre (contraste élevé)
function ProductTile({ product, color, onPick }: { product: ApiProduct; color?: string; onPick: () => void }) {
  const prices = product.variants.length ? product.variants.map((v) => Number(v.price)) : [Number(product.price)]
  const min = Math.min(...prices)
  const varies = Math.max(...prices) !== min
  const choices = product.variants.length
  // Combien de ce produit dans la vente en cours : on voit ce qu'on a déjà tapé
  const inCart = useCartStore((st) => st.lines.reduce((n, l) => (l.product.id === product.id ? n + l.quantity : n), 0))

  return (
    <button
      type="button"
      onClick={onPick}
      style={color ? { background: `color-mix(in srgb, ${color} 16%, var(--base-surface))`, borderColor: `color-mix(in srgb, ${color} 45%, var(--base-surface))` } : undefined}
      className="group relative flex h-full min-h-[112px] w-full flex-col justify-between gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 pt-5 text-left hover:border-[var(--color-border-strong)] press"
    >
      {color && <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />}
      {inCart > 0 && (
        <span
          className="qty-in tabular absolute right-2.5 top-3.5 grid h-7 min-w-7 place-items-center rounded-[var(--radius-pill)] bg-[var(--color-text-primary)] px-2 text-sm font-semibold text-[var(--color-bg-base)]"
        >
          {inCart}
          <span className="sr-only"> dans la vente</span>
        </span>
      )}
      <span className="block">
        <span className={`block text-[15px] font-semibold leading-snug ${inCart > 0 ? 'pr-9' : ''}`}>{product.name}</span>
        {product.subtitle && (
          <span className="mt-0.5 block text-sm text-[var(--color-text-secondary)]">{product.subtitle}</span>
        )}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="tabular text-[15px] font-medium">
          {varies && <span className="text-[var(--color-text-secondary)]">dès </span>}
          {formatPrice(min)}
        </span>
        {choices > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {choices} choix
          </span>
        )}
      </span>
    </button>
  )
}

function TileSkeletons() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <li
          key={i}
          className="h-[112px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-hover)] motion-reduce:animate-none"
        />
      ))}
    </ul>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{text}</p>
    </div>
  )
}
