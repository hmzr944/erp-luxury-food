// Fond de caisse : comptage par coupures et consigne de dépôt. Partagé entre
// l'écran (calcul instantané) et le serveur (qui fait foi). Tout en centimes.

export const EURO_DENOMINATIONS = [
  { cents: 50000, label: '500 €', kind: 'billet' },
  { cents: 20000, label: '200 €', kind: 'billet' },
  { cents: 10000, label: '100 €', kind: 'billet' },
  { cents: 5000, label: '50 €', kind: 'billet' },
  { cents: 2000, label: '20 €', kind: 'billet' },
  { cents: 1000, label: '10 €', kind: 'billet' },
  { cents: 500, label: '5 €', kind: 'billet' },
  { cents: 200, label: '2 €', kind: 'pièce' },
  { cents: 100, label: '1 €', kind: 'pièce' },
  { cents: 50, label: '50 c', kind: 'pièce' },
  { cents: 20, label: '20 c', kind: 'pièce' },
  { cents: 10, label: '10 c', kind: 'pièce' },
  { cents: 5, label: '5 c', kind: 'pièce' },
  { cents: 2, label: '2 c', kind: 'pièce' },
  { cents: 1, label: '1 c', kind: 'pièce' },
] as const

const VALID = new Set<number>(EURO_DENOMINATIONS.map((d) => d.cents))

export class CashCountError extends Error {}

// { "2000": 5, "200": 10 } → 12000 centimes
export function countCash(denominations: Record<string, number>): number {
  let total = 0
  for (const [key, n] of Object.entries(denominations)) {
    const cents = Number(key)
    if (!VALID.has(cents)) throw new CashCountError(`Coupure inconnue : ${key}`)
    if (!Number.isInteger(n) || n < 0 || n > 100_000) throw new CashCountError('Quantité invalide')
    total += cents * n
  }
  return total
}

export interface ClosingPlan {
  counted: number
  expected: number
  difference: number // compté - attendu ; négatif : il manque de l'argent
  withinTolerance: boolean
  keep: number // à laisser dans le tiroir pour demain
  deposit: number // à mettre dans l'enveloppe de dépôt
}

export function closingPlan(input: { counted: number; expected: number; floatTarget: number; tolerance: number }): ClosingPlan {
  const difference = input.counted - input.expected
  const keep = Math.max(0, Math.min(input.floatTarget, input.counted))
  return {
    counted: input.counted,
    expected: input.expected,
    difference,
    withinTolerance: Math.abs(difference) <= input.tolerance,
    keep,
    deposit: input.counted - keep,
  }
}

export const CASH_DIFFERENCE_REASONS = [
  'Erreur de rendu de monnaie',
  'Pourboire laissé en espèces',
  'Achat de petit matériel',
  'Vente encaissée en espèces mais saisie en carte',
] as const

// --- Composition du fond ------------------------------------------------------
// Parmi l'argent compté, quelles pièces et quels billets laisser dans le
// tiroir pour atteindre le fond cible, en gardant le plus de monnaie possible
// (petites coupures) ; le reste part à la banque. Somme exacte quand c'est
// possible, sinon la plus proche en dessous.

export interface FloatSplit {
  keep: Record<string, number>
  deposit: Record<string, number>
  keepTotal: number // centimes
  depositTotal: number
  exact: boolean
}

export function splitFloat(denominations: Record<string, number>, targetCents: number): FloatSplit {
  const counted = countCash(denominations)
  const target = Math.max(0, Math.min(targetCents, counted))
  // Sac à dos borné (découpage binaire des quantités) : pour chaque montant
  // atteignable, le plus grand nombre de pièces et billets
  const items: Array<{ cents: number; n: number }> = []
  for (const [key, count] of Object.entries(denominations)) {
    let left = count
    for (let k = 1; left > 0; k *= 2) {
      const take = Math.min(k, left)
      items.push({ cents: Number(key), n: take })
      left -= take
    }
  }
  const best = new Int32Array(target + 1).fill(-1)
  const choice: Array<Int32Array> = []
  best[0] = 0
  items.forEach((it, i) => {
    const w = it.cents * it.n
    const taken = new Int32Array(target + 1)
    for (let v = target; v >= w; v--) {
      if (best[v - w] >= 0 && best[v - w] + it.n > best[v]) {
        best[v] = best[v - w] + it.n
        taken[v] = 1
      }
    }
    choice[i] = taken
  })
  let v = target
  while (v > 0 && best[v] < 0) v--
  const keep: Record<string, number> = {}
  for (let i = items.length - 1, rest = v; i >= 0 && rest > 0; i--) {
    if (choice[i][rest]) {
      keep[items[i].cents] = (keep[items[i].cents] ?? 0) + items[i].n
      rest -= items[i].cents * items[i].n
    }
  }
  const deposit: Record<string, number> = {}
  for (const [key, count] of Object.entries(denominations)) {
    const d = count - (keep[key] ?? 0)
    if (d > 0) deposit[key] = d
  }
  return { keep, deposit, keepTotal: v, depositTotal: counted - v, exact: v === target }
}

// --- Réglage automatique ------------------------------------------------------
// Sans rien régler : le fond et la tolérance découlent des ventes en espèces
// des quatre dernières semaines.

export interface CashRecommendation {
  floatTarget: number // euros
  tolerance: number
  reasons: string[]
}

const roundUpTo = (n: number, step: number) => Math.ceil(n / step) * step

export function recommendCash(input: { days: number; cashTickets: number; cashTotal: number; fallbackFloat: number }): CashRecommendation {
  if (input.cashTickets < 10) {
    return {
      floatTarget: input.fallbackFloat,
      tolerance: 2,
      reasons: ['Pas encore assez de ventes en espèces : réglage habituel de votre métier'],
    }
  }
  const avgTicket = input.cashTotal / input.cashTickets
  const perDay = input.cashTotal / Math.max(1, input.days)
  const ticketsPerDay = input.cashTickets / Math.max(1, input.days)
  // La monnaie à rendre dépend du nombre de ventes en espèces, pas de leur
  // montant : une boulangerie rend beaucoup, une boutique de mode peu
  const floatTarget = Math.min(300, Math.max(100, roundUpTo(100 + 2.5 * ticketsPerDay, 50)))
  const tolerance = Math.min(10, Math.max(1, roundUpTo(perDay * 0.002, 0.5)))
  return {
    floatTarget,
    tolerance,
    reasons: [
      `Ticket moyen en espèces : ${avgTicket.toFixed(2).replace('.', ',')} €`,
      `${Math.round(ticketsPerDay)} ventes en espèces par jour en moyenne : de quoi rendre la monnaie toute la matinée`,
      `Tolérance de 0,2 % des espèces encaissées par jour (${perDay.toFixed(0)} €)`,
    ],
  }
}

// Lecture pour le vendeur : « 2 billets de 20 €, 5 pièces de 1 € »
export function describeCash(denominations: Record<string, number>): string[] {
  return EURO_DENOMINATIONS.filter((d) => (denominations[String(d.cents)] ?? 0) > 0).map((d) => {
    const n = denominations[String(d.cents)]
    return `${n} ${d.kind}${n > 1 ? 's' : ''} de ${d.label}`
  })
}
