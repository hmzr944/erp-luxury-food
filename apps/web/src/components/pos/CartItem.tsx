'use client'

import { motion } from 'framer-motion'
import { Minus, Plus, Trash } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { useCartStore, type CartLine } from '@/stores/cart.store'

interface CartItemProps {
  line: CartLine
}

export function CartItem({ line }: CartItemProps) {
  const { setQuantity, removeProduct } = useCartStore()
  const lineTotal = (line.product.price * line.quantity - line.discount)
  const lineTTC = lineTotal * (1 + line.product.taxRate / 100)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col gap-1.5 py-3 border-b border-[var(--color-border)] last:border-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-body text-[13px] text-[var(--color-text-primary)] leading-snug truncate">
            {line.product.name}
          </p>
          {line.variantName && (
            <p className="font-body text-[11px] text-[var(--color-text-muted)]">
              {line.variantName}
            </p>
          )}
        </div>
        <span className="font-data text-sm text-[var(--color-text-primary)] shrink-0">
          {formatPrice(lineTTC)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setQuantity(line.product.id, line.quantity - 1, line.variantId)}
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] active:scale-95 transition-all"
            aria-label="Diminuer"
          >
            <Minus size={10} weight="bold" />
          </button>

          <motion.span
            key={line.quantity}
            initial={{ scale: 1.3, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            className="font-data text-sm text-[var(--color-text-primary)] w-6 text-center"
          >
            {line.quantity}
          </motion.span>

          <button
            onClick={() => setQuantity(line.product.id, line.quantity + 1, line.variantId)}
            className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] active:scale-95 transition-all"
            aria-label="Augmenter"
          >
            <Plus size={10} weight="bold" />
          </button>
        </div>

        <button
          onClick={() => removeProduct(line.product.id, line.variantId)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1"
          aria-label="Supprimer"
        >
          <Trash size={13} weight="regular" />
        </button>
      </div>
    </motion.div>
  )
}
