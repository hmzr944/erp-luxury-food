'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight } from '@phosphor-icons/react'
import { formatPrice } from '@erp/utils'
import { consolidatedDashboardApi } from '@/lib/api/invoices'
import { useAuthStore } from '@/stores/auth.store'
import Link from 'next/link'
import { EASE_OUT } from '@/lib/motion'

// Une ligne de chiffres posés sur la typographie, séparés par des filets.
// Seul le chiffre d'affaires prend le violet.
function ConsolidatedKPI({
  label, value, sub, accent, index,
}: { label: string; value: string; sub?: string; accent?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: EASE_OUT }}
      className="px-5 py-5"
    >
      <p className="font-body text-sm text-[var(--color-text-secondary)]">{label}</p>
      <p className={`tabular mt-2 font-display text-4xl font-bold leading-none tracking-[-0.035em] ${accent ? 'text-[var(--color-accent)]' : ''}`}>{value}</p>
      {sub && <p className="mt-2 font-body text-sm text-[var(--color-text-secondary)]">{sub}</p>}
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
        <h1 className="page-title">
          {user?.firstName ? `Bonjour, ${user.firstName}` : 'Tableau de bord'}
        </h1>
        <p className="font-body text-sm text-[var(--color-text-secondary)] mt-1 first-letter:uppercase">{today}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs consolidés */}
        {isLoading ? (
          <div className="h-32 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] animate-pulse" />
        ) : (
          <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:grid-cols-4 [&>*]:border-[var(--color-border)] [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0">
            <ConsolidatedKPI label="CA total du jour" value={formatPrice(data?.revenue ?? 0)} accent index={0} />
            <ConsolidatedKPI label="Commandes" value={String(data?.orderCount ?? 0)} sub={`${data?.siteCount ?? 0} site${(data?.siteCount ?? 0) > 1 ? 's' : ''}`} index={1} />
            <ConsolidatedKPI label="Panier moyen" value={formatPrice(data?.avgBasket ?? 0)} index={2} />
            <ConsolidatedKPI label="En cours" value={String(data?.inProgress ?? 0)} sub="toutes boutiques" index={3} />
          </div>
        )}

        {/* Breakdown par site */}
        {!isLoading && (data?.perSite?.length ?? 0) > 1 && (
          <div>
            <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Par boutique</h2>
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
                      <p className="font-body text-[15px] font-medium text-[var(--color-text-primary)]">{site.siteName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden max-w-[160px]">
                          <div
                            className="h-full bg-[var(--color-accent)] rounded-full transition-colors"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="tabular text-sm text-[var(--color-text-secondary)]">
                          {pct.toFixed(0)} %
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="tabular font-display text-lg font-semibold">
                        {formatPrice(site.revenue)}
                      </p>
                      <p className="tabular text-sm text-[var(--color-text-secondary)]">
                        {site.orderCount} commande{site.orderCount > 1 ? 's' : ''}
                        {site.inProgress > 0 && `, ${site.inProgress} en cours`}
                      </p>
                    </div>

                    <Link
                      href={`/pos/${site.siteId}`}
                      aria-label={`Ouvrir la caisse ${site.siteName}`}
                      className="ml-3 grid size-10 place-items-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] rounded-[var(--radius-pill)] transition-colors"
                    >
                      <ArrowRight size={18} aria-hidden />
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
