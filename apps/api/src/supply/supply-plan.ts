// Calculs de l'approvisionnement interne, sans base de données : heure de
// clôture, quantité suggérée, correspondance labo ↔ boutique.

// --- Dates locales du site (fuseau IANA) ---------------------------------

// Décalage du fuseau à un instant donné, en minutes (Paris l'été : +120)
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - at.getTime()) / 60_000)
}

// Date du jour (AAAA-MM-JJ) dans le fuseau du site
export function localDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Instant UTC correspondant à « jour à HH:MM » heure locale
export function zonedTime(day: string, hhmm: string, timeZone: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const guess = new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000)
  // Second passage : corrige le cas où le changement d'heure tombe entre les deux
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60_000)
}

// Une livraison le jour D se commande avant D - leadDays à l'heure de clôture
export function cutoffFor(deliveryDay: string, cutoff: string, leadDays: number, timeZone: string): Date {
  return zonedTime(addDays(deliveryDay, -leadDays), cutoff, timeZone)
}

// Prochaine livraison qu'on peut encore commander
export function nextDelivery(now: Date, cutoff: string, leadDays: number, timeZone: string) {
  const today = localDay(now, timeZone)
  let deliveryDay = addDays(today, leadDays)
  if (now >= cutoffFor(deliveryDay, cutoff, leadDays, timeZone)) deliveryDay = addDays(deliveryDay, 1)
  return { deliveryDay, cutoffAt: cutoffFor(deliveryDay, cutoff, leadDays, timeZone) }
}

// --- Quantité suggérée ----------------------------------------------------

const WEEKDAYS = ['dimanches', 'lundis', 'mardis', 'mercredis', 'jeudis', 'vendredis', 'samedis']

export interface Suggestion {
  quantity: number
  reason: string
}

// Ventes du même jour de semaine sur les dernières semaines, plus une marge,
// moins ce qui est déjà en stock. Sans historique : la dernière commande.
export function suggestQuantity(input: {
  weekday: number // jour de livraison, 0 = dimanche
  sameWeekdaySales: number[] // une valeur par semaine, la plus récente d'abord
  stock: number | null // null : stock non suivi
  lastOrdered: number | null
  margin?: number // 0.1 = +10 %
}): Suggestion {
  const margin = input.margin ?? 0.1
  const weeks = input.sameWeekdaySales.length
  const sold = input.sameWeekdaySales.reduce((a, b) => a + b, 0)
  if (weeks > 0 && sold > 0) {
    const avg = sold / weeks
    const need = Math.ceil(avg * (1 + margin))
    const stock = input.stock && input.stock > 0 ? Math.floor(input.stock) : 0
    const quantity = Math.max(0, need - stock)
    const parts = [
      `${fmt(avg)} vendus en moyenne les ${weeks} derniers ${WEEKDAYS[input.weekday]}`,
      `+${Math.round(margin * 100)} %`,
      ...(stock ? [`${stock} en stock`] : []),
    ]
    return { quantity, reason: parts.join(', ') }
  }
  if (input.lastOrdered && input.lastOrdered > 0) return { quantity: input.lastOrdered, reason: 'Comme la dernière commande' }
  return { quantity: 0, reason: 'Pas encore de ventes pour calculer' }
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

// --- Correspondance produit du labo ↔ produit de la boutique -------------

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export interface MatchCandidate {
  id: string
  name: string
  sku: string | null
  barcode: string | null
}

// Même référence, sinon même code-barres, sinon même nom
export function matchProduct<T extends MatchCandidate>(source: MatchCandidate, candidates: T[]): T | null {
  if (source.sku) {
    const bySku = candidates.find((c) => c.sku && norm(c.sku) === norm(source.sku))
    if (bySku) return bySku
  }
  if (source.barcode) {
    const byBarcode = candidates.find((c) => c.barcode === source.barcode)
    if (byBarcode) return byBarcode
  }
  return candidates.find((c) => norm(c.name) === norm(source.name)) ?? null
}

export function matchVariant<T extends { id: string; name: string; sku: string | null }>(
  source: { name: string; sku: string | null },
  candidates: T[],
): T | null {
  if (source.sku) {
    const bySku = candidates.find((c) => c.sku && norm(c.sku) === norm(source.sku))
    if (bySku) return bySku
  }
  return candidates.find((c) => norm(c.name) === norm(source.name)) ?? null
}
