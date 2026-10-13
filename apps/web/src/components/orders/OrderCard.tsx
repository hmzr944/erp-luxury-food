'use client'

import { motion } from 'framer-motion'
import { CreditCard, Money, Clock, Storefront, ShoppingBag } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { StatusBadge } from './StatusBadge'
import { OrderStatus } from '@erp/types'

interface OrderCardItem {
  name: string
  quantity: number
}

interface OrderCardProps {
  id: string
  counter?: number
  status: OrderStatus
  channel: string
  paymentMode: string
  total: number
  items: OrderCardItem[]
  createdAt: string
  isNew?: boolean
  onChangeStatus: (id: string, status: OrderStatus) => void
}

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  PENDING:   { label: 'Commencer',    next: OrderStatus.PREPARING },
  PREPARING: { label: 'Prêt',         next: OrderStatus.READY },
  READY:     { label: 'Servi',        next: OrderStatus.COMPLETED },
}

const CHANNEL_ICON: Record<string, React.ElementType> = {
  IN_STORE:      Storefront,
  CLICK_COLLECT: ShoppingBag,
  B2B:           CreditCard,
}

const PAYMENT_ICON: Record<string, React.ElementType> = {
  CARD:         CreditCard,
  CASH:         Money,
  TICKET_RESTO: CreditCard,
  INVOICE:      CreditCard,
}

export function OrderCard({
  id, counter, status, channel, paymentMode, total, items, createdAt, isNew, onChangeStatus,
}: OrderCardProps) {
  const time = new Date(createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const action = NEXT_STATUS[status]
  const ChannelIcon = CHANNEL_ICON[channel] ?? Storefront
  const PayIcon = PAYMENT_ICON[paymentMode] ?? CreditCard

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className={[
        'flex flex-col bg-[var(--color-bg-surface)] border rounded-[var(--radius-lg)] overflow-hidden',
        isNew
          ? 'border-[var(--color-accent)]/60 shadow-[0_0_0_1px_var(--color-accent)/20]'
          : 'border-[var(--color-border)]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <ChannelIcon size={12} weight="regular" className="text-[var(--color-text-muted)]" />
          {counter && (
            <span className="font-data text-[11px] text-[var(--color-text-muted)]">
              #{counter}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
          <Clock size={10} weight="regular" />
          <span className="font-data text-[10px]">{time}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-3 py-2.5 flex-1 space-y-1 min-h-[56px]">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="font-body text-[12px] text-[var(--color-text-primary)] truncate max-w-[140px]">
              {item.name}
            </span>
            <span className="font-data text-[11px] text-[var(--color-text-muted)] shrink-0 ml-2">
              x{item.quantity}
            </span>
          </div>
        ))}
        {items.length > 3 && (
          <p className="font-body text-[11px] text-[var(--color-text-muted)]">
            +{items.length - 3} autre{items.length - 3 > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PayIcon size={11} weight="regular" className="text-[var(--color-text-muted)]" />
          <span className="font-data text-sm text-[var(--color-text-primary)]">
            {formatPrice(total)}
          </span>
        </div>

        {action && (
          <motion.button
            onClick={() => onChangeStatus(id, action.next)}
            whileTap={{ scale: 0.96 }}
            className={[
              'px-3 py-1.5 rounded-[var(--radius-sm)] font-body text-[11px] font-medium transition-all',
              action.next === 'PREPARING'
                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                : action.next === 'READY'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {action.label}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
