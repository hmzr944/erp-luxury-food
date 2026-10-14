'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, Trash } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { isFixedLine, lineDetail, useCartStore, type CartLine } from '@/stores/cart.store'
import { EASE } from './Sheet'

interface TicketProps {
  totals: { subtotal: number; taxAmount: number; total: number; itemCount: number }
  priceIncludesTax: boolean
  onCheckout: () => void
}

export function Ticket({ totals, priceIncludesTax, onCheckout }: TicketProps) {
  const { lines, clearCart } = useCartStore()
  const empty = lines.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Vente
          {totals.itemCount > 0 && (
            <span className="ml-2 text-base font-normal text-[var(--color-text-muted)] tabular">
              {totals.itemCount} {totals.itemCount > 1 ? 'articles' : 'article'}
            </span>
          )}
        </h2>
        {!empty && (
          <button
            type="button"
            onClick={clearCart}
            className="h-11 rounded-[var(--radius-pill)] px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            Vider
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {empty ? (
          <p className="pt-10 text-center text-[15px] text-[var(--color-text-muted)]">
            Touchez un produit pour l&apos;ajouter.
          </p>
        ) : (
          <ul aria-label="Articles de la vente">
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <TicketLine key={line.key} line={line} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <dl className="space-y-1 text-sm text-[var(--color-text-secondary)]">
          <div className="flex justify-between">
            <dt>{priceIncludesTax ? 'dont TVA' : 'TVA'}</dt>
            <dd className="tabular">{formatPrice(totals.taxAmount)}</dd>
          </div>
          <div className="flex items-baseline justify-between pt-1 text-[var(--color-text-primary)]">
            <dt className="text-base font-semibold">Total</dt>
            <dd className="tabular text-3xl font-semibold tracking-tight" aria-live="polite">
              {formatPrice(totals.total)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onCheckout}
          disabled={empty}
          className="mt-3 h-14 w-full rounded-[var(--radius-md)] bg-[var(--color-accent)] text-lg font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] press"
        >
          Encaisser
        </button>
      </div>
    </div>
  )
}

function TicketLine({ line }: { line: CartLine }) {
  const { setQuantity, removeLine } = useCartStore()
  const lineTotal = line.product.price * line.quantity - line.discount

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, transform: 'translateY(-6px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateX(8px)' }}
      transition={{ duration: 0.18, ease: EASE }}
      className="flex items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{line.product.name}</p>
        <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">{lineDetail(line) || formatPrice(line.product.price)}</p>
      </div>

      {isFixedLine(line) ? (
        <button
          type="button"
          onClick={() => removeLine(line.key)}
          aria-label={`Retirer ${line.product.name}`}
          className="grid size-11 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          <Trash size={18} />
        </button>
      ) : (
        <div className="flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setQuantity(line.key, line.quantity - 1)}
            aria-label={line.quantity === 1 ? `Retirer ${line.product.name}` : 'Un de moins'}
            className="grid size-11 place-items-center rounded-[var(--radius-pill)] hover:bg-[var(--color-bg-hover)]"
          >
            {line.quantity === 1 ? <Trash size={18} /> : <Minus size={18} />}
          </button>
          <span className="tabular w-6 text-center text-[15px] font-semibold" aria-label={`Quantité ${line.quantity}`}>
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(line.key, line.quantity + 1)}
            aria-label="Un de plus"
            className="grid size-11 place-items-center rounded-[var(--radius-pill)] hover:bg-[var(--color-bg-hover)]"
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      <span className="tabular w-20 text-right text-[15px] font-medium">{formatPrice(lineTotal)}</span>
    </motion.li>
  )
}

