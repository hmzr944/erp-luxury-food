// Dates limites des lots. Le jour se lit en heure de Paris : un lot « périmé
// aujourd'hui » dépend du calendrier du commerce, pas de celui du serveur (UTC).

export type LotStatus = 'NO_DATE' | 'EXPIRED' | 'TODAY' | 'SOON' | 'NEAR' | 'OK'
export type LotFilter = 'all' | 'expired' | '7' | '30'
export type DateKind = 'DLC' | 'DDM'

const TIMEZONE = 'Europe/Paris'
const DAY_MS = 86_400_000

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Jour calendaire de Paris (AAAA-MM-JJ) d'un instant
export function parisDay(date: Date): string {
  return dayFormat.format(date)
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS

// Nombre de jours entre aujourd'hui (Paris) et la date limite : négatif si dépassée
export function daysLeft(expiresAt: Date, now: Date = new Date()): number {
  return Math.round(dayNumber(parisDay(expiresAt)) - dayNumber(parisDay(now)))
}

// Dépassé dès le lendemain de la date limite : le jour même, le lot reste vendable
export function lotStatus(expiresAt: Date | null, now: Date = new Date()): { status: LotStatus; daysLeft: number | null } {
  if (!expiresAt) return { status: 'NO_DATE', daysLeft: null }
  const d = daysLeft(expiresAt, now)
  if (d < 0) return { status: 'EXPIRED', daysLeft: d }
  if (d === 0) return { status: 'TODAY', daysLeft: d }
  if (d <= 7) return { status: 'SOON', daysLeft: d }
  if (d <= 30) return { status: 'NEAR', daysLeft: d }
  return { status: 'OK', daysLeft: d }
}

// « Dans 7 jours » et « dans 30 jours » commencent aujourd'hui et excluent les lots déjà périmés
export function matchesFilter(days: number | null, filter: LotFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'expired':
      return days !== null && days < 0
    case '7':
      return days !== null && days >= 0 && days <= 7
    case '30':
      return days !== null && days >= 0 && days <= 30
  }
}

export const isLotFilter = (v: unknown): v is LotFilter => v === 'all' || v === 'expired' || v === '7' || v === '30'

// Le type de date est une valeur du produit (attributs) : sans précision, on
// la traite comme une date limite de consommation, la lecture la plus prudente
export function dateKindOf(attributes: unknown): DateKind {
  const kind = attributes && typeof attributes === 'object' ? (attributes as Record<string, unknown>).dateKind : undefined
  return kind === 'DDM' ? 'DDM' : 'DLC'
}

// Produits à écouler : un lot qui expire dans la semaine (aujourd'hui compris), regroupé par produit
export interface ClearingLine {
  productId: string
  name: string
  unit: string
  quantity: number
  daysLeft: number
  lots: number
}

export function productsToClear(
  lots: Array<{ productId: string; productName: string; unit: string; quantity: number; daysLeft: number | null }>,
): ClearingLine[] {
  const byProduct = new Map<string, ClearingLine>()
  for (const l of lots) {
    if (l.daysLeft === null || l.daysLeft < 0 || l.daysLeft > 7 || l.quantity <= 0) continue
    const line = byProduct.get(l.productId)
    if (line) {
      line.quantity += l.quantity
      line.lots += 1
      line.daysLeft = Math.min(line.daysLeft, l.daysLeft)
    } else {
      byProduct.set(l.productId, { productId: l.productId, name: l.productName, unit: l.unit, quantity: l.quantity, daysLeft: l.daysLeft, lots: 1 })
    }
  }
  return [...byProduct.values()].sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, 'fr'))
}

// Produits dont tout le stock en lots est périmé : la caisse prévient le vendeur
export function onlyExpired(lots: Array<{ productId: string; quantity: number; daysLeft: number | null }>): string[] {
  const state = new Map<string, { expired: boolean; fresh: boolean }>()
  for (const l of lots) {
    if (l.quantity <= 0) continue
    const s = state.get(l.productId) ?? { expired: false, fresh: false }
    if (l.daysLeft !== null && l.daysLeft < 0) s.expired = true
    else s.fresh = true
    state.set(l.productId, s)
  }
  return [...state].filter(([, s]) => s.expired && !s.fresh).map(([id]) => id)
}
