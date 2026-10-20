import { apiClient } from '@/lib/api/client'

export const PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Ce mois-ci' },
  { key: 'lastMonth', label: 'Mois dernier' },
] as const

export type PeriodKey = (typeof PERIODS)[number]['key']
export const DEFAULT_PERIOD: PeriodKey = 'today'

// Paramètre d'URL ?periode= : toute valeur inconnue retombe sur « aujourd'hui »
export function periodFromParam(value: string | null | undefined): PeriodKey {
  return PERIODS.find((p) => p.key === value)?.key ?? DEFAULT_PERIOD
}

export interface SiteSummary {
  siteId: string
  siteName: string
  revenue: number
  orderCount: number
  avgBasket: number
  inProgress: number
  share: number | null
  previous: { revenue: number; orderCount: number }
  variation: { revenue: number | null; orderCount: number | null }
}

export interface ConsolidatedDashboard {
  period: { key: PeriodKey; label: string; timezone: string; from: string; to: string; previousFrom: string; previousTo: string }
  revenue: number
  orderCount: number
  avgBasket: number
  inProgress: number
  siteCount: number
  previous: { revenue: number; orderCount: number; avgBasket: number }
  variation: { revenue: number | null; orderCount: number | null; avgBasket: number | null }
  perSite: SiteSummary[]
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>
}

export const consolidatedApi = {
  get: (period: PeriodKey) => apiClient<ConsolidatedDashboard>(`/dashboard/consolidated?period=${period}`),
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const NBSP = ' '

// « +12 % », « −3,5 % », « 0 % » : le signe est dit, pas seulement montré
export function formatPercent(value: number, signed = false): string {
  const sign = signed && value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${nf.format(Math.abs(value))}${NBSP}%`
}

export interface VariationText {
  direction: 'up' | 'down' | 'flat' | 'none'
  // Texte vu à l'écran
  visible: string
  // Texte lu par les lecteurs d'écran : « en hausse de 12 % par rapport à la période précédente »
  spoken: string
}

export function describeVariation(value: number | null): VariationText {
  if (value === null) {
    return {
      direction: 'none',
      visible: 'Sans comparaison',
      spoken: 'Comparaison impossible : la période précédente n’a pas de ventes',
    }
  }
  const against = 'par rapport à la période précédente'
  if (value === 0) return { direction: 'flat', visible: formatPercent(0), spoken: `stable ${against}` }
  return value > 0
    ? { direction: 'up', visible: formatPercent(value, true), spoken: `en hausse de ${formatPercent(value)} ${against}` }
    : { direction: 'down', visible: formatPercent(value), spoken: `en baisse de ${formatPercent(Math.abs(value))} ${against}` }
}

// « 1 au 25 octobre 2026 » en heure de Paris ; `to` est exclu, on affiche la veille
export function describeRange(from: string, to: string, timeZone = 'Europe/Paris'): string {
  const start = new Date(from)
  const end = new Date(new Date(to).getTime() - 1)
  const day = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone, ...o }).format(d)
  const same = day(start, { year: 'numeric', month: 'numeric', day: 'numeric' }) === day(end, { year: 'numeric', month: 'numeric', day: 'numeric' })
  if (same) return day(start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const sameMonth = day(start, { month: 'numeric', year: 'numeric' }) === day(end, { month: 'numeric', year: 'numeric' })
  const startText = sameMonth ? day(start, { day: 'numeric' }) : day(start, { day: 'numeric', month: 'long' })
  return `du ${startText} au ${day(end, { day: 'numeric', month: 'long', year: 'numeric' })}`
}
