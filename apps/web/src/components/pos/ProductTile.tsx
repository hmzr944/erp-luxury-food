'use client'

import { motion } from 'framer-motion'
import { formatPrice } from '@erp/utils'
import type { ApiProduct } from '@/lib/api/products'

interface ProductTileProps {
  product: ApiProduct
  onAdd: (product: ApiProduct) => void
}

export function ProductTile({ product, onAdd }: ProductTileProps) {
  const categoryColor = product.category?.color ?? '#555550'

  return (
    <motion.button
      onClick={() => onAdd(product)}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="relative flex flex-col text-left w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)] active:bg-[var(--color-bg-hover)] transition-colors group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
      aria-label={`Ajouter ${product.name}`}
    >
      {/* Bande couleur catégorie en haut */}
      <span
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: categoryColor, opacity: 0.6 }}
      />

      <div className="flex flex-col gap-1 px-3 pt-4 pb-3">
        <span className="font-body text-[13px] font-medium text-[var(--color-text-primary)] leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {product.name}
        </span>

        {product.subtitle && (
          <span className="font-body text-[11px] text-[var(--color-text-muted)] truncate">
            {product.subtitle}
          </span>
        )}
      </div>

      <div className="mt-auto px-3 pb-3 flex items-center justify-between">
        <span className="font-data text-sm text-[var(--color-accent)]">
          {formatPrice(product.price)}
        </span>

        {product.taxRate !== 5.5 && (
          <span className="font-data text-[9px] text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] px-1.5 py-0.5 rounded-full">
            TVA {product.taxRate}%
          </span>
        )}
      </div>
    </motion.button>
  )
}
