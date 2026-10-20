// Quand prévenir le vendeur que des ventes en attente sont fragiles.
// Logique pure : le composant ne fait qu'afficher ce qu'elle décide.

// Une vente signée reste en attente trop longtemps au-delà de ce délai
export const PENDING_MAX_AGE_MINUTES = 30
// Trop de ventes à risque dans un seul appareil
export const PENDING_MAX_COUNT = 10

export type PendingAlertKind = 'near-full' | 'volatile' | 'old' | 'many'

export interface PendingAlert {
  kind: PendingAlertKind
  message: string
}

export interface PendingAlertInput {
  pending: number
  // Date (ms) de la plus ancienne vente en attente
  oldestPendingAt: number | null
  now: number
  online: boolean
  // false : le navigateur peut vider la base ; null : inconnu
  persisted: boolean | null
  nearlyFull: boolean
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

export function pendingAlert(i: PendingAlertInput): PendingAlert | null {
  if (i.pending <= 0) return i.nearlyFull ? nearFull() : null
  const ageMin = i.oldestPendingAt == null ? 0 : (i.now - i.oldestPendingAt) / 60_000
  const todo = i.online
    ? 'Touchez « Envoyer maintenant » pour les envoyer.'
    : 'Reconnectez-vous au réseau pour envoyer vos ventes.'

  if (i.pending >= PENDING_MAX_COUNT) {
    return { kind: 'many', message: `${i.pending} ventes sont en attente d'envoi. ${todo}` }
  }
  if (ageMin >= PENDING_MAX_AGE_MINUTES) {
    return {
      kind: 'old',
      message: `${i.pending} ${plural(i.pending, 'vente attend', 'ventes attendent')} d'être envoyée${i.pending > 1 ? 's' : ''} depuis plus de ${PENDING_MAX_AGE_MINUTES} minutes. ${todo}`,
    }
  }
  if (i.persisted === false) {
    return {
      kind: 'volatile',
      message: `Cet appareil peut effacer ${i.pending > 1 ? 'vos ventes en attente' : 'votre vente en attente'}. ${todo}`,
    }
  }
  return i.nearlyFull ? nearFull() : null
}

function nearFull(): PendingAlert {
  return {
    kind: 'near-full',
    message: "L'espace de cet appareil est presque plein. Libérez de l'espace pour que les prochaines ventes soient bien gardées.",
  }
}
