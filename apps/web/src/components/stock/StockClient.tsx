'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowDown,
  ArrowUp,
  Warning,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { stockApi, type StockItemApi, type StockMovementApi } from '@/lib/api/stock'
import { formatDate } from '@erp/utils'

const MOVEMENT_LABELS: Record<string, { label: string; sign: string; color: string }> = {
  // Le signe et le libellé disent le mouvement ; pas de couleur d'alerte pour une vente
  SALE:       { label: 'Vente',       sign: '-', color: 'text-[var(--color-text-secondary)]' },
  RESTOCK:    { label: 'Réassort',    sign: '+', color: 'text-[var(--color-text-primary)]' },
  ADJUSTMENT: { label: 'Ajustement',  sign: '±', color: 'text-[var(--color-text-secondary)]' },
  TRANSFER:   { label: 'Transfert',   sign: '-', color: 'text-[var(--color-text-secondary)]' },
  LOSS:       { label: 'Perte',       sign: '-', color: 'text-[var(--color-text-secondary)]' },
}

type Tab = 'inventory' | 'movements' | 'alerts'

interface StockClientProps { siteId: string }

function StockBar({ quantity, alertAt }: { quantity: number; alertAt: number | null }) {
  const isLow = alertAt !== null && quantity <= alertAt
  // Jauge relative au seuil (plein à 4 fois le seuil) ; sans seuil, pas de jauge
  const pct = alertAt ? Math.min(100, (Math.max(0, quantity) / (alertAt * 4)) * 100) : null

  return (
    <div className="flex items-center gap-2">
      {pct !== null && (
        <div className="w-20 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden" aria-hidden>
          <div
            className={['h-full rounded-full', isLow ? 'bg-[var(--color-bg-inverse)]' : 'bg-[var(--color-accent)]'].join(' ')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <span className="tabular text-sm font-medium">
        {Number(quantity).toFixed(0)}
        {alertAt !== null && <span className="font-normal text-[var(--color-text-secondary)]"> / seuil {alertAt}</span>}
      </span>
      {/* Stock bas : dit en toutes lettres, pas seulement par la couleur */}
      {isLow && (
        <span className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-bg-inverse)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-inverse)]">
          <Warning size={12} weight="fill" aria-hidden /> Bas
        </span>
      )}
    </div>
  )
}

export function StockClient({ siteId }: StockClientProps) {
  const [tab, setTab] = useState<Tab>('inventory')
  const qc = useQueryClient()

  const { data: inventory = [], isLoading: loadInv } = useQuery({
    queryKey: ['stock-inventory', siteId],
    queryFn: () => stockApi.getInventory(siteId),
  })

  const { data: movements = [], isLoading: loadMov } = useQuery({
    queryKey: ['stock-movements', siteId],
    queryFn: () => stockApi.getMovements(siteId),
    enabled: tab === 'movements',
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['stock-alerts', siteId],
    queryFn: () => stockApi.getAlerts(siteId),
  })

  const addMovement = useMutation({
    mutationFn: (data: { productId: string; type: string; quantity: number; reason?: string }) =>
      stockApi.addMovement(siteId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-inventory', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-movements', siteId] })
      qc.invalidateQueries({ queryKey: ['stock-alerts', siteId] })
      toast.success('Mouvement enregistré')
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  })

  const TABS: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'inventory', label: 'Inventaire', count: inventory.length },
    { key: 'movements', label: 'Mouvements' },
    { key: 'alerts',   label: 'Alertes', count: alerts.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="page-title">Stock</h1>
          {alerts.length > 0 && (
            <p className="flex items-center gap-1.5 mt-0.5 font-body text-xs text-[var(--color-warning)]">
              <Warning size={11} weight="fill" />
              {alerts.length} produit{alerts.length > 1 ? 's' : ''} sous le seuil d'alerte
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-[var(--color-border)]">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] font-body text-sm transition-colors',
              tab === key
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
            ].join(' ')}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={[
                'tabular text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                key === 'alerts' && count > 0
                  ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
              ].join(' ')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'inventory' && (
          <div className="space-y-0">
            {loadInv
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-12 mb-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
                ))
              : inventory.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-[var(--color-text-primary)] truncate">
                        {item.product.name}
                      </p>
                      {item.product.sku && (
                        <p className="font-data text-xs text-[var(--color-text-muted)]">
                          {item.product.sku}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <StockBar quantity={Number(item.quantity)} alertAt={item.alertAt ? Number(item.alertAt) : null} />

                      <span className="tabular text-sm text-[var(--color-text-muted)] w-12 text-right">
                        {item.unit}
                      </span>

                      {/* Quick restock button */}
                      <button
                        onClick={() =>
                          addMovement.mutate({
                            productId: item.product.id,
                            type: 'RESTOCK',
                            quantity: 10,
                            reason: 'Réassort manuel',
                          })
                        }
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-success)] hover:border-[var(--color-success)]/30 transition-colors text-sm font-body"
                      >
                        <ArrowUp size={10} weight="bold" />
                        +10
                      </button>
                    </div>
                  </motion.div>
                ))}
          </div>
        )}

        {tab === 'movements' && (
          <div className="space-y-0">
            {loadMov
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-10 mb-1 rounded bg-[var(--color-bg-surface)] animate-pulse" />
                ))
              : movements.map((m) => {
                  const info = MOVEMENT_LABELS[m.type] ?? MOVEMENT_LABELS.ADJUSTMENT
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="tabular text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded-[var(--radius-sm)] w-20 text-center">
                          {info.label}
                        </span>
                        <div>
                          <p className="font-body text-sm text-[var(--color-text-primary)]">
                            Produit
                          </p>
                          {m.reason && (
                            <p className="font-body text-sm text-[var(--color-text-muted)]">
                              {m.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`tabular text-sm ${info.color}`}>
                          {info.sign}{Number(m.quantity).toFixed(0)}
                        </span>
                        <span className="tabular text-xs text-[var(--color-text-muted)]">
                          {new Date(m.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })}
          </div>
        )}

        {tab === 'alerts' && (
          alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <Package size={32} weight="regular" className="text-[var(--color-text-muted)]" />
              <p className="font-body text-sm text-[var(--color-text-muted)]">
                Aucune alerte de stock
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20 rounded-[var(--radius-md)]"
                >
                  <div className="flex items-center gap-3">
                    <Warning size={14} weight="fill" className="text-[var(--color-danger)] shrink-0" />
                    <div>
                      <p className="font-body text-sm text-[var(--color-text-primary)]">
                        {item.product.name}
                      </p>
                      <p className="tabular text-sm text-[var(--color-text-primary)]">
                        Stock: {Number(item.quantity).toFixed(0)} {item.unit} (seuil: {Number(item.alertAt).toFixed(0)})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      addMovement.mutate({
                        productId: item.product.id,
                        type: 'RESTOCK',
                        quantity: 20,
                        reason: 'Réassort urgence',
                      })
                    }
                    className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] font-body text-xs hover:bg-[var(--color-success)]/20 transition-colors"
                  >
                    Réassort +20
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
