// Contrat commun à tous les terminaux de paiement pilotés par le pont.

export type PaymentStatus = 'approved' | 'declined' | 'cancelled' | 'error'

export interface PaymentResult {
  status: PaymentStatus
  // Message court en français pour le vendeur (motif du refus, etc.)
  message?: string
  authorizationCode?: string
  maskedPan?: string
  cardType?: string
  transactionId?: string
  receiptText?: string
  // Réponse brute du terminal, pour le support et l'audit
  raw?: unknown
}

export interface PaymentEvent {
  // Étape lisible par la caisse (présentation carte, code, autorisation...)
  step: string
  message: string
}

export type PaymentEventSink = (e: PaymentEvent) => void

export interface PaymentAdapter {
  readonly name: string
  // Identifie le terminal physique : un seul paiement à la fois par cible
  readonly target: string
  start(amountCents: number, currency: string, reference: string, onEvent: PaymentEventSink): Promise<PaymentResult>
  // Demande d'annulation. Certains protocoles ne savent pas annuler à
  // distance : l'adaptateur le dit dans le message retourné.
  cancel(): { accepted: boolean; message: string }
}
