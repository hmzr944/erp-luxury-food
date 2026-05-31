import type { OrderStatus } from '@erp/types'

const CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING:   { label: 'En attente',    className: 'status-pending' },
  PREPARING: { label: 'En préparation',className: 'status-preparing' },
  READY:     { label: 'Prête',         className: 'status-ready' },
  COMPLETED: { label: 'Servie',        className: 'status-completed' },
  CANCELLED: { label: 'Annulée',       className: 'status-cancelled' },
  REFUNDED:  { label: 'Remboursée',    className: 'status-refunded' },
}

interface StatusBadgeProps {
  status: OrderStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, className } = CONFIG[status] ?? CONFIG.PENDING
  return (
    <span
      className={[
        className,
        'inline-flex items-center rounded-full font-data font-medium leading-none',
        size === 'sm' ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1.5',
      ].join(' ')}
    >
      {label}
    </span>
  )
}
