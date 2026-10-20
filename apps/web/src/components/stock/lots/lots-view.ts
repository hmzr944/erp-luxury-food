import type { DateKind, LotRow, LotStatus } from '@/lib/api/lots'

// Libellés des états d'un lot. L'identité n'a ni rouge ni vert : l'état se lit
// dans le mot, doublé d'une icône et d'une forme de pastille (voir LotBadge).

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

export function statusLabel(status: LotStatus, daysLeft: number | null, kind: DateKind = 'DLC'): string {
  switch (status) {
    case 'NO_DATE':
      return 'Sans date'
    case 'EXPIRED':
      return kind === 'DDM' ? 'Date dépassée' : 'Périmé'
    case 'TODAY':
      return 'Dernier jour'
    default: {
      const d = daysLeft ?? 0
      return d === 1 ? 'Demain' : `Dans ${d} jours`
    }
  }
}

// Complément sous l'état : depuis combien de temps ou jusqu'à quand
export function statusDetail(status: LotStatus, daysLeft: number | null): string | null {
  if (status === 'EXPIRED' && daysLeft !== null) {
    const n = Math.abs(daysLeft)
    return `depuis ${n} ${plural(n, 'jour', 'jours')}`
  }
  if (status === 'TODAY') return 'à vendre aujourd’hui'
  return null
}

export const dateKindLabel = (kind: DateKind) => (kind === 'DDM' ? 'DDM' : 'DLC')

export const dateKindHelp: Record<DateKind, string> = {
  DLC: 'Date limite de consommation : « à consommer jusqu’au ». Pour les produits frais et périssables.',
  DDM: 'Date de durabilité minimale : « à consommer de préférence avant ». Pour l’épicerie sèche et les conserves.',
}

// 2026-10-20 -> 20 oct. 2026 (jour de calendrier, sans décalage de fuseau)
export function formatDay(day: string | null): string {
  if (!day) return 'Sans date'
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
}

export const todayInParis = (now: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

export function quantityLabel(quantity: number, unit: string): string {
  const n = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(quantity)
  return unit === 'unité' ? n : `${n} ${unit}`
}

export function lotTitle(lot: Pick<LotRow, 'productName' | 'variantName'>): string {
  return lot.variantName ? `${lot.productName} (${lot.variantName})` : lot.productName
}

export const REASONS = ['Périmé', 'Emballage abîmé', 'Cassé ou renversé', 'Invendable', 'Don'] as const
