// Contrat commun aux prestataires de TPE connectés. La caisse ne connaît
// que ce contrat : ajouter un prestataire ne touche ni la caisse ni l'API.

export type Http = (url: string, init?: RequestInit) => Promise<Response>

export type RemoteStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED'

export interface ConnectorContext {
  credentials: Record<string, string>
  http: Http
}

export interface PairInput {
  code: string
  name: string
  // Stripe : adresse du lieu d'installation du lecteur (obligatoire chez Stripe)
  address?: { line1: string; city: string; postalCode: string; country: string }
}

export interface PaymentConnector {
  // Vérifie les identifiants ; renvoie le mode test et un libellé lisible
  verify(ctx: ConnectorContext): Promise<{ testMode: boolean; label: string }>
  // Appaire un lecteur à partir du code affiché à l'écran du TPE.
  // Peut renvoyer des identifiants mis à jour (ex. lieu Stripe créé)
  pair(ctx: ConnectorContext, input: PairInput): Promise<{ externalId: string; credentials?: Record<string, string> }>
  start(
    ctx: ConnectorContext,
    input: { readerId: string; amount: number; currency: string; reference: string; description: string },
  ): Promise<{ providerRef: string }>
  status(
    ctx: ConnectorContext,
    input: { readerId: string; providerRef: string },
  ): Promise<{ status: RemoteStatus; failureReason?: string }>
  cancel(ctx: ConnectorContext, input: { readerId: string; providerRef: string }): Promise<void>
  // Rembourse tout ou partie d'un paiement accepté (montant en centimes)
  refund(ctx: ConnectorContext, input: { providerRef: string; amount: number }): Promise<{ refundRef: string }>
  // Mode test uniquement : simule le passage d'une carte
  simulate?(ctx: ConnectorContext, input: { readerId: string; providerRef: string; approve: boolean }): Promise<void>
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}
