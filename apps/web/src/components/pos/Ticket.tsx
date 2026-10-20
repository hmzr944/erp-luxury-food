'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, Tag, Trash, UserCircle, X } from '@phosphor-icons/react'
import { discountPercent, discountReasonLabel, formatPrice, rewardsAvailable } from '@erp/utils'
import { hasManualDiscount, isFixedLine, lineDetail, loyaltyRoom, ticketDiscountRoom, useCartStore, withTicketDiscount, type CartLine } from '@/stores/cart.store'
import type { LoyaltySettings } from '@/lib/api/customers'
import { EASE } from './Sheet'
import { DiscountSheet, type DiscountTarget } from './DiscountSheet'

interface TicketProps {
  totals: { subtotal: number; taxAmount: number; total: number; itemCount: number }
  priceIncludesTax: boolean
  onCheckout: () => void
  // Contenu affiché quand la vente est vide (accueil du mode découverte)
  emptyState?: React.ReactNode
  // Programme de fidélité actif : client rattaché à la vente
  loyalty?: LoyaltySettings
  onCustomer?: () => void
}

export function Ticket({ totals, priceIncludesTax, onCheckout, emptyState, loyalty, onCustomer }: TicketProps) {
  const { lines, clearCart, loyalty: used, ticketDiscount } = useCartStore()
  const empty = lines.length === 0
  const [discounting, setDiscounting] = useState<DiscountTarget | null>(null)
  // Remise du ticket : part retirée sur l'ensemble des lignes éligibles
  const ticketAmount = ticketDiscount ? withTicketDiscount(lines, ticketDiscount).reduce((a, l, i) => a + Math.round((l.discount - lines[i].discount) * 100), 0) / 100 : 0

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
        {empty && emptyState ? (
          <div className="py-2">{emptyState}</div>
        ) : empty ? (
          <p className="pt-10 text-center text-[15px] text-[var(--color-text-muted)]">
            Touchez un produit pour l&apos;ajouter.
          </p>
        ) : (
          <ul aria-label="Articles de la vente">
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <TicketLine key={line.key} line={line} onDiscount={() => setDiscounting({ kind: 'line', key: line.key })} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {loyalty?.enabled && onCustomer && <CustomerRow rules={loyalty} onCustomer={onCustomer} />}
        {!empty && ticketDiscountRoom(lines) > 0 && (
          <button
            type="button"
            onClick={() => setDiscounting({ kind: 'ticket' })}
            className="mb-3 flex h-11 w-full items-center gap-2 rounded-[var(--radius-pill)] border border-dashed border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
          >
            <Tag size={20} aria-hidden /> {ticketDiscount ? 'Modifier la remise sur le ticket' : 'Remise sur le ticket'}
          </button>
        )}
        <dl className="space-y-1 text-sm text-[var(--color-text-secondary)]">
          {ticketDiscount && ticketAmount > 0 && (
            <div className="flex justify-between">
              <dt>
                Remise sur le ticket ({ticketDiscount.mode === 'percent' ? `${String(ticketDiscount.value).replace('.', ',')} %` : formatPrice(ticketDiscount.value)}
                {ticketDiscount.reason ? `, ${discountReasonLabel(ticketDiscount.reason)}` : ''})
              </dt>
              <dd className="tabular">-{formatPrice(ticketAmount)}</dd>
            </div>
          )}
          {used && (
            <div className="flex justify-between">
              <dt>Fidélité ({used.points} points)</dt>
              <dd className="tabular">-{formatPrice(used.amount)}</dd>
            </div>
          )}
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
      <DiscountSheet target={discounting} onClose={() => setDiscounting(null)} />
    </div>
  )
}

// Client de la vente : points, récompense à utiliser, détacher
function CustomerRow({ rules, onCustomer }: { rules: LoyaltySettings; onCustomer: () => void }) {
  const { lines, customer, setCustomer, loyalty, setLoyalty, ticketDiscount } = useCartStore()
  // Récompense fidélité et remise manuelle ne se cumulent pas
  const manual = hasManualDiscount(lines, ticketDiscount)
  if (!customer) {
    return (
      <button
        type="button"
        onClick={onCustomer}
        className="mb-3 flex h-11 w-full items-center gap-2 rounded-[var(--radius-pill)] border border-dashed border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
      >
        <UserCircle size={20} aria-hidden /> Ajouter un client fidélité
      </button>
    )
  }
  // Récompense : paliers atteints, sans dépasser les articles hors cartes cadeaux
  const room = loyaltyRoom(lines)
  const available = rewardsAvailable(customer.points, rules)
  const fits = rules.reward > 0 ? Math.min(available.count, Math.floor((room + 0.001) / rules.reward)) : 0
  return (
    <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
      <div className="flex items-center gap-2">
        <UserCircle size={22} aria-hidden className="shrink-0 text-[var(--color-accent)]" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
          {customer.name} <span className="tabular font-normal text-[var(--color-text-secondary)]">{customer.points} pts</span>
        </p>
        <button
          type="button"
          onClick={() => setCustomer(null)}
          aria-label={`Détacher ${customer.name} de la vente`}
          className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          <X size={18} />
        </button>
      </div>
      {loyalty ? (
        <button type="button" onClick={() => setLoyalty(null)} className="mt-1 h-11 w-full rounded-[var(--radius-pill)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">
          Garder les points pour plus tard
        </button>
      ) : available.count > 0 ? (
        <button
          type="button"
          disabled={fits === 0 || manual}
          onClick={() => setLoyalty({ points: fits * rules.threshold, amount: Math.round(fits * rules.reward * 100) / 100 })}
          className="mt-2 h-11 w-full rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] text-sm font-semibold text-[var(--color-text-inverse)] disabled:opacity-50"
        >
          {manual ? 'Remise manuelle en cours : pas de récompense' : fits === 0 ? `${formatPrice(rules.reward)} offerts dès ${formatPrice(rules.reward)} d’achat` : `Utiliser ${formatPrice(fits * rules.reward)} offerts`}
        </button>
      ) : (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Encore {rules.threshold - (customer.points % rules.threshold)} points avant {formatPrice(rules.reward)} offerts
        </p>
      )}
    </div>
  )
}

function TicketLine({ line, onDiscount }: { line: CartLine; onDiscount: () => void }) {
  const { setQuantity, removeLine } = useCartStore()
  const gross = line.product.price * line.quantity
  const lineTotal = gross - line.discount
  const name = line.product.giftCard ? 'Carte cadeau' : line.product.name
  const reason = discountReasonLabel(line.discountSpec?.reason)

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
        <p className="truncate text-[15px] font-medium">{line.product.giftCard ? 'Carte cadeau' : line.product.name}</p>
        <p className="line-clamp-2 text-sm text-[var(--color-text-secondary)]">{lineDetail(line) || formatPrice(line.product.price)}</p>
        {line.product.giftCard ? null : (
          <button
            type="button"
            onClick={onDiscount}
            aria-label={line.discount > 0 ? `Modifier la remise sur ${name}` : `Remise sur ${name}`}
            className="-ml-2 mt-0.5 flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-left text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <Tag size={18} aria-hidden className="shrink-0" />
            <span>{line.discount > 0 ? `Remise ${String(discountPercent(line.discount, gross)).replace('.', ',')} %${reason ? `, ${reason}` : ''}` : 'Remise'}</span>
          </button>
        )}
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

      <span className="tabular w-20 text-right text-[15px] font-medium">
        {line.discount > 0 && (
          <s className="block text-sm font-normal text-[var(--color-text-secondary)]" aria-label={`Prix avant remise ${formatPrice(gross)}`}>
            {formatPrice(gross)}
          </s>
        )}
        {formatPrice(lineTotal)}
      </span>
    </motion.li>
  )
}

