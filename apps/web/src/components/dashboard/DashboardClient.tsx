'use client'

import { useQuery } from '@tanstack/react-query'
import {
  CurrencyEur,
  ShoppingCart,
  Basket,
  HourglassMedium,
  Trophy,
} from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { KPICard } from './KPICard'
import { RevenueChart } from './RevenueChart'
import { StatusBadge } from '@/components/orders/StatusBadge'
import { dashboardApi } from '@/lib/api/dashboard'
import type { OrderStatus } from '@erp/types'

interface DashboardClientProps {
  siteId: string
  siteName: string
}

export function DashboardClient({ siteId, siteName }: DashboardClientProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', siteId],
    queryFn: () => dashboardApi.getSummary(siteId),
    refetchInterval: 60_000,
  })

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--color-border)]">
        <h1 className="page-title">{siteName}</h1>
        <p className="font-body text-xs text-[var(--color-text-muted)] mt-0.5 capitalize">{today}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="CA du jour"
            value={isLoading ? '...' : formatPrice(data?.revenue ?? 0)}
            icon={CurrencyEur}
            accent
            index={0}
          />
          <KPICard
            label="Commandes"
            value={isLoading ? '...' : String(data?.orderCount ?? 0)}
            sub="complétées aujourd'hui"
            icon={ShoppingCart}
            index={1}
          />
          <KPICard
            label="Panier moyen"
            value={isLoading ? '...' : formatPrice(data?.avgBasket ?? 0)}
            icon={Basket}
            index={2}
          />
          <KPICard
            label="En cours"
            value={isLoading ? '...' : String(data?.inProgress ?? 0)}
            sub="commandes actives"
            icon={HourglassMedium}
            index={3}
          />
        </div>

        {/* Chart */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4">
          <p className="font-body text-xs text-[var(--color-text-muted)] mb-4">
            Chiffre d'affaires par heure
          </p>
          {isLoading ? (
            <div className="h-[180px] animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)]" />
          ) : (
            <RevenueChart data={data?.revenueByHour ?? []} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top produits */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={13} weight="regular" className="text-[var(--color-text-muted)]" />
              <p className="font-body text-xs text-[var(--color-text-muted)]">Top produits</p>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 rounded bg-[var(--color-bg-elevated)] animate-pulse" />
                ))}
              </div>
            ) : data?.topProducts.length === 0 ? (
              <p className="font-body text-xs text-[var(--color-text-muted)]">Aucune vente aujourd'hui</p>
            ) : (
              <div className="space-y-2">
                {data?.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular text-xs text-[var(--color-text-muted)] w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-body text-sm text-[var(--color-text-primary)] truncate max-w-[140px]">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="tabular text-xs text-[var(--color-text-muted)]">
                        x{p.quantity}
                      </span>
                      <span className="tabular text-xs text-[var(--color-text-secondary)]">
                        {formatPrice(p.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commandes récentes */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4">
            <p className="font-body text-xs text-[var(--color-text-muted)] mb-4">Récentes</p>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-[var(--color-bg-elevated)] animate-pulse" />
                ))}
              </div>
            ) : data?.recentOrders.length === 0 ? (
              <p className="font-body text-xs text-[var(--color-text-muted)]">Aucune commande</p>
            ) : (
              <div className="space-y-2">
                {data?.recentOrders.slice(0, 6).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {order.receiptChain && (
                        <span className="tabular text-xs text-[var(--color-text-muted)]">
                          #{order.receiptChain.counter}
                        </span>
                      )}
                      <StatusBadge status={order.status as OrderStatus} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-xs text-[var(--color-text-muted)]">
                        {new Date(order.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="tabular text-sm text-[var(--color-text-primary)]">
                        {formatPrice(Number(order.total))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
