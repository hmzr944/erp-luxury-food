// Règles du stock, sans accès à la base : testées seules

export const CORRECTION_REASONS = {
  CASSE: 'Casse',
  VOL: 'Vol',
  ERREUR_SAISIE: 'Erreur de saisie',
  DON: 'Don',
  AUTRE: 'Autre',
} as const

export type CorrectionReason = keyof typeof CORRECTION_REASONS
export const CORRECTION_REASON_CODES = Object.keys(CORRECTION_REASONS) as CorrectionReason[]

// Mouvements qu'un gérant saisit à la main. Les ventes, transferts et
// retours viennent d'autres flux ; l'ajustement passe par la correction
// ou l'inventaire.
export const MANUAL_MOVEMENT_TYPES = ['RESTOCK', 'LOSS'] as const
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number]

// Effet d'un mouvement sur la quantité en stock. Entrée : positif. Sortie
// (vente, perte, transfert) : toujours négatif, quel que soit le signe saisi.
// Ajustement : la quantité du mouvement est signée et suit l'écart.
export function movementDelta(type: string, quantity: number): number {
  if (type === 'ADJUSTMENT') return quantity
  if (type === 'SALE' || type === 'LOSS' || type === 'TRANSFER') return -Math.abs(quantity)
  return Math.abs(quantity)
}

// Écart entre la quantité réelle comptée et celle du stock (3 décimales)
export function gap(counted: number, expected: number): number {
  return Math.round((counted - expected) * 1000) / 1000
}

export function reasonText(code: CorrectionReason, note?: string | null): string {
  const label = CORRECTION_REASONS[code]
  const detail = note?.trim()
  return detail ? `${label} : ${detail}` : label
}

// Date « jj/mm/aaaa » dans le fuseau du site
export function frDate(d: Date, timeZone = 'Europe/Paris'): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone })
}
