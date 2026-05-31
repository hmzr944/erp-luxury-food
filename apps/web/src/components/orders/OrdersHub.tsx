'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Lightning, FunnelSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { OrderCard } from './OrderCard'
import { useSocket } from '@/hooks/useSocket'
import { ordersApi, type ApiOrder } from '@/lib/api/orders'
import type { OrderStatus } from '@erp/types'

const STATUS_TABS: Array<{ key: OrderStatus | 'ALL'; label: string; color: string }> = [
  { key: 'ALL',       label: 'Toutes',          color: 'text-[var(--color-text-secondary)]' },
  { key: 'PENDING',   label: 'En attente',      color: 'text-yellow-400' },
  { key: 'PREPARING', label: 'En préparation',  color: 'text-blue-400' },
  { key: 'READY',     label: 'Prêtes',          color: 'text-green-400' },
  { key: 'COMPLETED', label: 'Servies',         color: 'text-[var(--color-text-muted)]' },
]

interface OrdersHubProps {
  siteId: string
}

export function OrdersHub({ siteId }: OrdersHubProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL')
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', siteId],
    queryFn: () => ordersApi.getAll(siteId, { limit: 80 }),
    refetchInterval: 30_000,
  })

  // WebSocket temps réel
  const { status: wsStatus, on } = useSocket(siteId)

  useEffect(() => {
    const unsubNew = on<ApiOrder>('order:new', (order) => {
      queryClient.setQueryData<ApiOrder[]>(['orders', siteId], (prev = []) => [order, ...prev])
      setNewOrderIds((ids) => new Set(ids).add(order.id))
      setTimeout(
        () => setNewOrderIds((ids) => { const s = new Set(ids); s.delete(order.id); return s }),
        4000,
      )
      toast.success(`Nouvelle commande #${order.receiptChain?.counter ?? ''}`, {
        description: `${order.items.length} article${order.items.length > 1 ? 's' : ''} · ${formatPrice(Number(order.total))}`,
      })
    })

    const unsubUpd = on<ApiOrder>('order:updated', (updated) => {
      queryClient.setQueryData<ApiOrder[]>(['orders', siteId], (prev = []) =>
        prev.map((o) => (o.id === updated.id ? updated : o)),
      )
    })

    return () => { unsubNew(); unsubUpd() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, queryClient])

  const handleChangeStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      // Optimistic update
      queryClient.setQueryData<ApiOrder[]>(['orders', siteId], (prev = []) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o)),
      )
      try {
        await ordersApi.updateStatus(siteId, id, status)
      } catch {
        queryClient.invalidateQueries({ queryKey: ['orders', siteId] })
        toast.error('Erreur lors du changement de statut')
      }
    },
    [siteId, queryClient],
  )

  const filtered = activeTab === 'ALL' ? orders : orders.filter((o) => o.status === activeTab)

  const countByStatus = (status: OrderStatus | 'ALL') =>
    status === 'ALL' ? orders.length : orders.filter((o) => o.status === status).length

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="font-display text-xl text-[var(--color-text-primary)]">Commandes</h1>
          <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'w-1.5 h-1.5 rounded-full',
                wsStatus === 'connected' ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-text-muted)]',
              ].join(' ')}
            />
            <span className="font-data text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
              {wsStatus === 'connected' ? 'Temps réel' : 'Hors ligne'}
            </span>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--color-border)] overflow-x-auto">
        {STATUS_TABS.map(({ key, label, color }) => {
          const count = countByStatus(key)
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] font-body text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span
                  className={[
                    'font-data text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    active
                      ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                      : 'bg-[var(--color-bg-elevated)] ' + color,
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-36 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <FunnelSimple size={24} weight="regular" className="text-[var(--color-text-muted)]" />
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              {activeTab === 'ALL' ? 'Aucune commande aujourd\'hui' : `Aucune commande avec ce statut`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence initial={false}>
              {filtered.map((order) => (
                <OrderCard
                  key={order.id}
                  id={order.id}
                  counter={order.receiptChain?.counter}
                  status={order.status as OrderStatus}
                  channel={order.channel}
                  paymentMode={order.paymentMode}
                  total={Number(order.total)}
                  items={order.items}
                  createdAt={order.createdAt}
                  isNew={newOrderIds.has(order.id)}
                  onChangeStatus={handleChangeStatus}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}
