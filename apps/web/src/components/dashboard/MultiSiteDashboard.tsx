'use client'

import { useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { formatPrice } from '@erp/utils'
import { useAuthStore } from '@/stores/auth.store'
import { EASE_OUT } from '@/lib/motion'
import { PeriodSelector } from './PeriodSelector'
import { Variation } from './Variation'
import { consolidatedApi, describeRange, formatPercent, periodFromParam, type ConsolidatedDashboard, type PeriodKey } from './network'

const qty = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

// Une ligne de chiffres posés sur la typographie, séparés par des filets.
// Seul le chiffre d'affaires prend le violet.
function Figure({
  label, value, note, variation, accent, index,
}: { label: string; value: string; note?: string; variation?: number | null; accent?: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: EASE_OUT }}
      className="min-w-0 px-4 py-5 sm:px-5"
    >
      <p className="font-body text-sm text-[var(--color-text-secondary)]">{label}</p>
      <p className={`tabular mt-2 truncate font-display text-2xl font-bold leading-none tracking-[-0.035em] sm:text-3xl lg:text-4xl ${accent ? 'text-[var(--color-accent)]' : ''}`}>{value}</p>
      <div className="mt-2 min-h-5">
        {variation !== undefined ? <Variation value={variation} /> : note ? <p className="font-body text-sm text-[var(--color-text-secondary)]">{note}</p> : null}
      </div>
    </motion.div>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">Chargement du tableau de bord</span>
      <div className="h-36 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      <div className="h-56 animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] p-5">
      <p className="flex items-center gap-2 font-body text-[15px] font-medium">
        <WarningCircle size={20} weight="fill" aria-hidden /> Impossible de charger le tableau de bord
      </p>
      <p className="font-body text-sm text-[var(--color-text-secondary)]">Vos chiffres n&apos;ont pas pu être récupérés. Vérifiez la connexion puis réessayez.</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-10 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 font-body text-sm font-medium text-[var(--color-on-accent)] transition-[background-color,transform] duration-150 hover:bg-[var(--color-accent-hover)] active:scale-[0.97]"
      >
        Réessayer
      </button>
    </div>
  )
}

function SiteRanking({ data }: { data: ConsolidatedDashboard }) {
  return (
    <section aria-labelledby="classement">
      <h2 id="classement" className="mb-3 font-display text-xl font-semibold tracking-tight">Classement des boutiques</h2>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Boutiques classées par chiffre d&apos;affaires sur la période, avec leur part du réseau et leur variation</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] font-body text-sm text-[var(--color-text-secondary)]">
              <th scope="col" className="px-4 py-3 font-medium">Boutique</th>
              <th scope="col" className="hidden w-40 px-3 py-3 font-medium md:table-cell">Part du CA</th>
              <th scope="col" className="hidden w-28 px-3 py-3 text-right font-medium sm:table-cell">Commandes</th>
              <th scope="col" className="w-28 px-3 py-3 text-right font-medium sm:w-32">CA</th>
              <th scope="col" className="w-24 px-3 py-3 text-right font-medium sm:w-28">Évolution</th>
              <th scope="col" className="hidden w-12 py-3 pr-2 sm:table-cell"><span className="sr-only">Caisse</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.perSite.map((site, i) => (
              <tr key={site.siteId} className="font-body">
                <th scope="row" className="min-w-0 px-4 py-3 text-left font-normal">
                  <span className="block break-words text-[15px] font-medium">
                    <span className="tabular mr-2 text-[var(--color-text-secondary)]">{i + 1}.</span>{site.siteName}
                  </span>
                  <span className="mt-0.5 block text-sm text-[var(--color-text-secondary)] sm:hidden">
                    {site.orderCount} commande{site.orderCount > 1 ? 's' : ''}
                    {site.share !== null && `, ${formatPercent(site.share)} du CA`}
                  </span>
                  {site.inProgress > 0 && <span className="block text-sm text-[var(--color-text-secondary)]">{site.inProgress} en cours</span>}
                </th>
                <td className="hidden px-3 py-3 md:table-cell">
                  {site.share === null ? (
                    <span className="text-sm text-[var(--color-text-secondary)]">Aucun CA</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden>
                        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.max(0, Math.min(100, site.share))}%` }} />
                      </div>
                      <span className="tabular w-14 text-right text-sm">{formatPercent(site.share)}</span>
                    </div>
                  )}
                </td>
                <td className="tabular hidden px-3 py-3 text-right text-sm sm:table-cell">{site.orderCount}</td>
                <td className="tabular px-3 py-3 text-right font-display text-base font-semibold sm:text-lg">{formatPrice(site.revenue)}</td>
                <td className="px-3 py-3 text-right"><Variation value={site.variation.revenue} className="justify-end text-xs sm:text-sm" /></td>
                <td className="hidden py-1 pr-2 text-right sm:table-cell">
                  <Link
                    href={`/pos/${site.siteId}`}
                    aria-label={`Ouvrir la caisse ${site.siteName}`}
                    className="grid size-10 place-items-center rounded-[var(--radius-pill)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent)]"
                  >
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TopProducts({ data }: { data: ConsolidatedDashboard }) {
  return (
    <section aria-labelledby="top-produits">
      <h2 id="top-produits" className="mb-3 font-display text-xl font-semibold tracking-tight">Top 5 des produits du réseau</h2>
      {data.topProducts.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-6 font-body text-sm text-[var(--color-text-secondary)]">
          Aucune vente de produit sur cette période.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Les cinq produits qui rapportent le plus sur l&apos;ensemble des boutiques, remboursements déduits</caption>
            <thead>
              <tr className="border-b border-[var(--color-border)] font-body text-sm text-[var(--color-text-secondary)]">
                <th scope="col" className="px-4 py-3 font-medium">Produit</th>
                <th scope="col" className="w-24 px-3 py-3 text-right font-medium">Quantité</th>
                <th scope="col" className="w-28 px-4 py-3 text-right font-medium sm:w-32">CA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.topProducts.map((p, i) => (
                <tr key={p.productId} className="font-body">
                  <th scope="row" className="truncate px-4 py-3 text-left text-[15px] font-medium">
                    <span className="tabular mr-2 text-[var(--color-text-secondary)]">{i + 1}.</span>{p.name}
                  </th>
                  <td className="tabular px-3 py-3 text-right text-sm">{qty.format(p.quantity)}</td>
                  <td className="tabular px-4 py-3 text-right font-display text-base font-semibold">{formatPrice(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MultiSiteDashboard() {
  const { user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // La période vit dans l'URL : lien partageable, retour arrière et rechargement la gardent
  const period = periodFromParam(params.get('periode'))

  const setPeriod = useCallback(
    (key: PeriodKey) => {
      const next = new URLSearchParams(params.toString())
      if (key === 'today') next.delete('periode')
      else next.set('periode', key)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['consolidated-dashboard', period],
    queryFn: () => consolidatedApi.get(period),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })

  const empty = !!data && data.orderCount === 0 && data.revenue === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{user?.firstName ? `Bonjour, ${user.firstName}` : 'Tableau de bord'}</h1>
          <p className="mt-1 font-body text-sm text-[var(--color-text-secondary)]" aria-live="polite">
            {data ? <span className="first-letter:uppercase">{describeRange(data.period.from, data.period.to, data.period.timezone)}</span> : 'Chargement de la période'}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="min-w-0 space-y-6 p-4 sm:p-6" aria-busy={isFetching}>
        {isLoading ? (
          <Skeleton />
        ) : isError && !data ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data ? (
          <>
            {isError && (
              <p role="alert" className="font-body text-sm text-[var(--color-text-secondary)]">
                Actualisation impossible : ces chiffres datent de la dernière mise à jour réussie.
              </p>
            )}
            <section aria-label="Chiffres du réseau">
              <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] lg:grid-cols-4 [&>*]:border-[var(--color-border)] [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0">
                <Figure label="CA du réseau" value={formatPrice(data.revenue)} variation={data.variation.revenue} accent index={0} />
                <Figure label="Commandes" value={String(data.orderCount)} variation={data.variation.orderCount} index={1} />
                <Figure label="Panier moyen" value={formatPrice(data.avgBasket)} variation={data.variation.avgBasket} index={2} />
                <Figure label="En cours" value={String(data.inProgress)} note={`${data.siteCount} boutique${data.siteCount > 1 ? 's' : ''}`} index={3} />
              </div>
              <p className="mt-2 font-body text-sm text-[var(--color-text-secondary)]">
                Évolution par rapport à la période précédente ({describeRange(data.period.previousFrom, data.period.previousTo, data.period.timezone)}). Remboursements déduits du CA.
              </p>
            </section>

            {empty && (
              <p className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-6 font-body text-sm text-[var(--color-text-secondary)]">
                Aucune vente sur cette période. Choisissez une période plus large pour voir l&apos;activité du réseau.
              </p>
            )}

            {data.perSite.length > 1 && <SiteRanking data={data} />}
            {!empty && <TopProducts data={data} />}
          </>
        ) : null}
      </div>
    </div>
  )
}
