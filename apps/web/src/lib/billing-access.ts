// Accès à la caisse selon l'abonnement, tel que le serveur l'a calculé.
// Gardé sur l'appareil pour fonctionner hors ligne. Le verrou n'empêche que
// de commencer une nouvelle vente : les ventes en attente partent toujours,
// clôtures, exports et réglages restent ouverts.

export type AccessState = 'trial' | 'active' | 'grace' | 'locked'

export interface AccessSnapshot {
  access: AccessState
  // Statut de l'abonnement : TRIALING, ACTIVE, PAST_DUE ou CANCELED
  status?: string
  lockAt: string | null
  trialEndsAt: string | null
}

const KEY = 'flow-acces'
const DAY_MS = 86_400_000
// Bandeau d'essai : seulement les 7 derniers jours
export const TRIAL_NOTICE_DAYS = 7

export function saveAccessSnapshot(s: AccessSnapshot) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ access: s.access, status: s.status, lockAt: s.lockAt, trialEndsAt: s.trialEndsAt }))
  } catch {
    // stockage indisponible : le statut sera redemandé
  }
}

export function readAccessSnapshot(): AccessSnapshot | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as AccessSnapshot
    return s && ['trial', 'active', 'grace', 'locked'].includes(s.access) ? s : null
  } catch {
    return null
  }
}

// Statut connu, avancé à l'heure de l'appareil : un délai de grâce passé
// hors ligne devient un verrou. Sans statut connu, rien n'est bloqué.
export function effectiveAccess(s: AccessSnapshot | null, now: Date = new Date()): AccessState | null {
  if (!s) return null
  if (s.access === 'grace' && s.lockAt && new Date(s.lockAt) <= now) return 'locked'
  return s.access
}

// Pourquoi l'accès se termine, dit simplement
export function endReason(status?: string) {
  if (status === 'PAST_DUE') return 'Le dernier paiement a échoué.'
  if (status === 'CANCELED') return 'Votre abonnement est arrêté.'
  return 'Votre essai est terminé.'
}

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

// Texte du bandeau discret, ou null quand il n'y a rien à dire
export function accessNotice(s: AccessSnapshot | null, now: Date = new Date()): string | null {
  const state = effectiveAccess(s, now)
  if (!s || !state) return null
  if (state === 'grace') {
    const why = endReason(s.status)
    return s.lockAt ? `${why} La caisse reste ouverte jusqu'au ${day(s.lockAt)}.` : why
  }
  if (state === 'trial' && s.trialEndsAt) {
    const left = Math.ceil((new Date(s.trialEndsAt).getTime() - now.getTime()) / DAY_MS)
    if (left > TRIAL_NOTICE_DAYS || left < 1) return null
    return `Votre essai se termine dans ${left} ${left > 1 ? 'jours' : 'jour'}, le ${day(s.trialEndsAt)}.`
  }
  return null
}
