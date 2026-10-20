// Périodes du tableau de bord, calculées en heure de Paris (jamais en heure
// du serveur) : minuit local est un instant UTC différent l'été et l'hiver,
// et le jour du changement d'heure dure 23 ou 25 heures.
import { addDays, localDay, zonedTime } from '../supply/supply-plan'

export const DASHBOARD_TZ = 'Europe/Paris'

export const PERIOD_KEYS = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth'] as const
export type PeriodKey = (typeof PERIOD_KEYS)[number]

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  month: 'Ce mois-ci',
  lastMonth: 'Mois dernier',
}

export interface PeriodRange {
  key: PeriodKey
  label: string
  // Bornes : from inclus, to exclu
  from: Date
  to: Date
  // Période précédente de même nature, pour la variation
  previous: { from: Date; to: Date }
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === 'string' && (PERIOD_KEYS as readonly string[]).includes(value)
}

// Minuit local du jour AAAA-MM-JJ
const midnight = (day: string) => zonedTime(day, '00:00', DASHBOARD_TZ)

const monthStart = (day: string) => `${day.slice(0, 7)}-01`

// Premier jour du mois, n mois plus tard (n peut être négatif)
function shiftMonth(firstOfMonth: string, n: number): string {
  const year = Number(firstOfMonth.slice(0, 4))
  const month = Number(firstOfMonth.slice(5, 7)) - 1 + n
  const y = year + Math.floor(month / 12)
  const m = ((month % 12) + 12) % 12
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-01`
}

const range = (from: string, to: string) => ({ from: midnight(from), to: midnight(to) })

// Règles :
// - jour, 7 et 30 jours : jours civils complets, aujourd'hui compris ; la
//   période précédente est la fenêtre de même durée juste avant
// - ce mois-ci : du 1er à la fin du mois ; la précédente est le mois d'avant,
//   limité au même nombre de jours que ce qui s'est écoulé (comparaison à
//   durée égale, pas un mois partiel contre un mois entier)
// - mois dernier : le mois civil entier, comparé au mois d'avant
export function resolvePeriod(key: PeriodKey, now: Date = new Date()): PeriodRange {
  const today = localDay(now, DASHBOARD_TZ)
  const label = PERIOD_LABELS[key]

  switch (key) {
    case 'today':
      return { key, label, ...range(today, addDays(today, 1)), previous: range(addDays(today, -1), today) }
    case 'yesterday': {
      const day = addDays(today, -1)
      return { key, label, ...range(day, today), previous: range(addDays(day, -1), day) }
    }
    case '7d':
    case '30d': {
      const n = key === '7d' ? 7 : 30
      const start = addDays(today, -(n - 1))
      return { key, label, ...range(start, addDays(today, 1)), previous: range(addDays(start, -n), start) }
    }
    case 'month': {
      const start = monthStart(today)
      const next = shiftMonth(start, 1)
      const prevStart = shiftMonth(start, -1)
      const elapsed = Number(today.slice(8, 10))
      const prevEnd = addDays(prevStart, elapsed)
      return { key, label, ...range(start, next), previous: range(prevStart, prevEnd < start ? prevEnd : start) }
    }
    case 'lastMonth': {
      const start = shiftMonth(monthStart(today), -1)
      const end = monthStart(today)
      return { key, label, ...range(start, end), previous: range(shiftMonth(start, -1), start) }
    }
  }
}

// Variation en % (une décimale). Sans base de comparaison exploitable
// (période précédente à zéro ou négative), null : jamais de pourcentage absurde.
export function variation(current: number, previous: number): number | null {
  if (!(previous > 0)) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
