'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingCart, Trash } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { useCartStore, computeCartTotals } from '@/stores/cart.store'
import { usePlatformConfig } from '@/lib/api/platform'
import { CartItem } from './CartItem'

interface CartProps {
  onCheckout: () => void
}

export function Cart({ onCheckout }: CartProps) {
  const { lines, orderDiscount, clearCart } = useCartStore()
  const { data: config } = usePlatformConfig()
  const { subtotal, taxAmount, total, itemCount } = computeCartTotals(
    lines,
    orderDiscount,
    config?.priceIncludesTax ?? true,
  )

  return (
    <aside className="flex flex-col w-72 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <ShoppingCart size={14} weight="regular" className="text-[var(--color-text-muted)]" />
          <span className="font-body text-sm text-[var(--color-text-primary)]">Commande</span>
          {itemCount > 0 && (
            <motion.span
              key={itemCount}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
              className="font-data text-[10px] bg-[var(--color-accent)] text-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
            >
              {itemCount}
            </motion.span>
          )}
        </div>

        {lines.length > 0 && (
          <button
            onClick={clearCart}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1"
            aria-label="Vider le panier"
          >
            <Trash size={13} weight="regular" />
          </button>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto px-4">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <ShoppingCart size={28} weight="regular" className="text-[var(--color-text-muted)]/40" />
            <p className="font-body text-sm text-[var(--color-text-muted)] text-center leading-relaxed">
              Sélectionnez des produits<br />pour commencer
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {lines.map((line) => (
              <CartItem
                key={`${line.product.id}:${line.variantId ?? ''}`}
                line={line}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Totaux + CTA */}
      {lines.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-4 pt-3 pb-4 space-y-2">
          <div className="flex justify-between">
            <span className="font-body text-xs text-[var(--color-text-muted)]">Sous-total HT</span>
            <span className="font-data text-xs text-[var(--color-text-secondary)]">
              {formatPrice(subtotal)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="font-body text-xs text-[var(--color-text-muted)]">TVA</span>
            <span className="font-data text-xs text-[var(--color-text-secondary)]">
              {formatPrice(taxAmount)}
            </span>
          </div>

          {orderDiscount > 0 && (
            <div className="flex justify-between">
              <span className="font-body text-xs text-[var(--color-text-muted)]">Remise commande</span>
              <span className="font-data text-xs text-[var(--color-danger)]">
                -{formatPrice(orderDiscount)}
              </span>
            </div>
          )}

          <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
            <span className="font-body text-sm font-semibold text-[var(--color-text-primary)]">
              Total TTC
            </span>
            <motion.span
              key={total.toFixed(2)}
              initial={{ opacity: 0.6, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-data text-base font-semibold text-[var(--color-text-primary)]"
            >
              {formatPrice(total)}
            </motion.span>
          </div>

          <motion.button
            onClick={onCheckout}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full h-12 mt-2 bg-[var(--color-accent)] text-black font-body text-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] active:-translate-y-px transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-surface)]"
          >
            Encaisser {formatPrice(total)}
          </motion.button>
        </div>
      )}
    </aside>
  )
}
