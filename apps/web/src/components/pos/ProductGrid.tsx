'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProductTile } from './ProductTile'
import type { ApiProduct } from '@/lib/api/products'

interface ProductGridProps {
  products: ApiProduct[]
  selectedCategory: string | null
  onAddProduct: (product: ApiProduct) => void
  isLoading: boolean
}

function ProductSkeleton() {
  return (
    <div className="h-24 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
  )
}

export function ProductGrid({
  products,
  selectedCategory,
  onAddProduct,
  isLoading,
}: ProductGridProps) {
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: / focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = useMemo(() => {
    let result = products

    if (selectedCategory) {
      result = result.filter((p) => p.categoryId === selectedCategory)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.subtitle?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q),
      )
    }

    return result
  }, [products, selectedCategory, search])

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher ou scanner un code-barre..."
            className="w-full h-9 pl-8 pr-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-[var(--radius-md)] font-body text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <MagnifyingGlass size={24} weight="regular" className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              {search ? `Aucun résultat pour "${search}"` : 'Aucun produit dans cette catégorie'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <ProductTile product={product} onAdd={onAddProduct} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
