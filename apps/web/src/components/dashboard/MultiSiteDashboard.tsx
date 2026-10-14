'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChartLine, ArrowRight } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { consolidatedDashboardApi } from '@/lib/api/invoices'
import { useAuthStore } from '@/stores/auth.store'
import Link from 'next/link'
import { EASE_OUT } from '@/lib/motion'
import { FlowMark } from '@/components/brand/FlowLogo'

function ConsolidatedKPI({
  label, value, sub, accent, index,
}: { label: string; value: string; sub?: string; accent?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: EASE_OUT }}
      className={[
        'relative overflow-hidden p-5 rounded-[var(--radius-lg)] border',
        accent
          ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-on-accent)]'
          : 'bg-[var(--color-bg-surface)] border-[var(--color-border)]',
      ].join(' ')}
    >
      {/* Le chiffre du jour porte le signe, les autres restent sobres */}
      {accent && <FlowMark size={88} inverse className="absolute -right-4 -bottom-6 opacity-20" />}
      <p className={`font-body text-sm mb-3 ${accent ? '' : 'text-[var(--color-text-secondary)]'}`}>{label}</p>
      <p className="tabular font-display text-3xl font-bold leading-none tracking-[-0.03em]">{value}</p>
      {sub && <p className={`font-body text-sm mt-1.5 ${accent ? '' : 'text-[var(--color-text-secondary)]'}`}>{sub}</p>}
    </motion.div>
  )
}

export function MultiSiteDashboard() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['consolidated-dashboard'],
    queryFn: consolidatedDashboardApi.get,
    refetchInterval: 60_000,
  })

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-5 border-b border-[var(--color-border)]">
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {user?.firstName ? `Bonjour, ${user.firstName}` : 'Tableau de bord'}
        </h1>
        <p className="font-body text-sm text-[var(--color-text-secondary)] mt-1 first-letter:uppercase">{today}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs consolidés */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ConsolidatedKPI label="CA total du jour" value={formatPrice(data?.revenue ?? 0)} accent index={0} />
            <ConsolidatedKPI label="Commandes" value={String(data?.orderCount ?? 0)} sub={`${data?.siteCount ?? 0} site${(data?.siteCount ?? 0) > 1 ? 's' : ''}`} index={1} />
            <ConsolidatedKPI label="Panier moyen" value={formatPrice(data?.avgBasket ?? 0)} index={2} />
            <ConsolidatedKPI label="En cours" value={String(data?.inProgress ?? 0)} sub="toutes boutiques" index={3} />
          </div>
        )}

        {/* Breakdown par site */}
        {!isLoading && (data?.perSite?.length ?? 0) > 1 && (
          <div>
            <p className="font-body text-xs text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">
              Par boutique
            </p>
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] divide-y divide-[var(--color-border)]">
              {(data?.perSite ?? []).map((site: any, i: number) => {
                const pct = data.revenue > 0 ? (site.revenue / data.revenue) * 100 : 0
                return (
                  <motion.div
                    key={site.siteId}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-[var(--color-text-primary)]">{site.siteName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-data text-[10px] text-[var(--color-text-muted)]">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-data text-sm text-[var(--color-text-primary)]">
                        {formatPrice(site.revenue)}
                      </p>
                      <p className="font-data text-[10px] text-[var(--color-text-muted)]">
                        {site.orderCount} cmd{site.orderCount > 1 ? 's' : ''}
                        {site.inProgress > 0 && ` · ${site.inProgress} en cours`}
                      </p>
                    </div>

                    <Link
                      href={`/pos/${site.siteId}`}
                      className="ml-3 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] rounded-[var(--radius-sm)] transition-all"
                      title="Ouvrir la caisse"
                    >
                      <ArrowRight size={13} />
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Lien vers le dashboard site-specific */}
        {!isLoading && (data?.siteCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <ChartLine size={12} className="text-[var(--color-text-muted)]" />
            <p className="font-body text-xs text-[var(--color-text-muted)]">
              Sélectionnez un site dans la barre latérale pour voir son dashboard détaillé (CA horaire, top produits).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
