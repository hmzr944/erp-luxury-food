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
