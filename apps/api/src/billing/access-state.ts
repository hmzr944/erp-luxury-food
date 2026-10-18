import type { ConfigService } from '@nestjs/config'

// Accès au service selon l'abonnement. Fonction pure : le statut d'abonnement
// et les dates suffisent, l'heure est passée en paramètre.
//
// Ce verrou ne touche jamais la conformité fiscale (art. 286 I 3° bis CGI) :
// une vente signée est toujours reçue, et les clôtures, archives, exports et
// l'attestation restent lisibles. Il ne sert qu'à empêcher de commencer de
// nouvelles ventes et les écritures qui supposent un usage continu.

export type AccessState = 'trial' | 'active' | 'grace' | 'locked'

// Après l'essai (ou un abonnement arrêté), la caisse reste ouverte une semaine
export const GRACE_DAYS = 7
const DAY_MS = 86_400_000

export interface AccessInput {
  subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  trialEndsAt: Date | null
  currentPeriodEnd?: Date | null
}

export interface Access {
  state: AccessState
  // Date à partir de laquelle la caisse ne peut plus commencer de vente ;
  // null quand aucun verrou n'est prévu
  lockAt: Date | null
}

const plusGrace = (d: Date) => new Date(d.getTime() + GRACE_DAYS * DAY_MS)
const latest = (...dates: Array<Date | null | undefined>) =>
  dates.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null)

export function accessState(org: AccessInput, now: Date = new Date(), options: { billingEnabled?: boolean } = {}): Access {
  if (org.subscriptionStatus === 'ACTIVE') return { state: 'active', lockAt: null }
  // Sans paiement en ligne (démo, auto-hébergement), on ne peut pas souscrire :
  // l'essai continue, rien n'est verrouillé
  if (options.billingEnabled === false) return { state: 'trial', lockAt: null }

  // Essai en cours, y compris après une résiliation faite pendant l'essai.
  // Sans date de fin (comptes anciens), l'essai n'a pas de terme
  if (org.subscriptionStatus === 'TRIALING' && !org.trialEndsAt) return { state: 'trial', lockAt: null }
  if (org.trialEndsAt && now < org.trialEndsAt && org.subscriptionStatus !== 'PAST_DUE') {
    return { state: 'trial', lockAt: plusGrace(org.trialEndsAt) }
  }

  // Fin de l'usage couvert : fin d'essai pour un essai, sinon la fin de la
  // dernière période connue (paiement en échec, abonnement arrêté)
  const endedAt = org.subscriptionStatus === 'TRIALING' ? org.trialEndsAt : latest(org.trialEndsAt, org.currentPeriodEnd)
  // Aucune date de référence : pas de verrou sans base
  if (!endedAt) return { state: 'grace', lockAt: null }
  const lockAt = plusGrace(endedAt)
  return { state: now < lockAt ? 'grace' : 'locked', lockAt }
}

// Paiement en ligne configuré sur ce serveur (mêmes clés que BillingService)
export function billingEnabled(config: ConfigService) {
  return !!config.get<string>('STRIPE_BILLING_SECRET_KEY') && !!config.get<string>('STRIPE_PRICE_STARTER')
}
