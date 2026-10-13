// Offre publique : un seul endroit pour les prix, lus par le site et l'application.
// Prix HT, par boutique et par mois, sans engagement. Aucune commission sur
// les paiements : la carte passe par le prestataire choisi par le commerçant.

export const TRIAL_DAYS = 30

export type PlanCode = 'STARTER' | 'PRO'

export interface PlanOffer {
  code: PlanCode
  name: string
  monthlyPrice: number // € HT par boutique
  summary: string
  features: string[]
}

export const PLAN_OFFERS: PlanOffer[] = [
  {
    code: 'STARTER',
    name: 'Pulse',
    monthlyPrice: 29,
    summary: 'Tout pour vendre et suivre une boutique.',
    features: [
      'Caisses illimitées sur tablette, téléphone ou ordinateur',
      'Ventes hors ligne, tickets signés',
      'TPE relié (SumUp, Stripe) ou votre TPE habituel',
      'Retours, échanges et avoirs',
      'Stock, tailles et couleurs, lots et dates limites',
      'Exports complets à tout moment',
    ],
  },
  {
    code: 'PRO',
    name: 'Tempo',
    monthlyPrice: 59,
    summary: 'Pour plusieurs boutiques, un labo ou un dépôt, et la vente aux professionnels.',
    features: [
      'Tout ce que contient Pulse',
      'Plusieurs boutiques dans un seul compte',
      'Commandes internes à un labo, une cuisine centrale ou un dépôt',
      'Cessions internes au prix de cession, mois par mois',
      'Clients professionnels et factures',
      'Accès API et webhooks',
    ],
  },
]

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
