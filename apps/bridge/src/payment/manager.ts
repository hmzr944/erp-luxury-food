// Orchestration des paiements : un seul paiement en cours par terminal
// physique (deux encaissements simultanés sur le même TPE seraient
// impossibles à démêler), annulation par identifiant.

import { randomUUID } from 'node:crypto'
import { BridgeError, int, str } from '../protocol.js'
import { CaisseApAdapter, CAISSE_AP_DEFAULT_PORT } from './caisse-ap.js'
import { SimulatorAdapter } from './simulator.js'
import type { PaymentAdapter, PaymentEvent, PaymentResult } from './types.js'

type Params = Record<string, unknown>

// Résultats gardés 30 minutes : une caisse rechargée en plein paiement
// retrouve l'issue avec payment.status au lieu de réencaisser à l'aveugle.
const RESULT_TTL_MS = 30 * 60 * 1000

export const PAYMENT_ADAPTERS = ['simulator', 'caisse-ap'] as const

interface InFlight {
  paymentId: string
  adapter: PaymentAdapter
}

export interface PaymentManagerOptions {
  simulatorDurationMs?: number
}

export class PaymentManager {
  private byTarget = new Map<string, InFlight>()
  private byId = new Map<string, InFlight>()
  private results = new Map<string, { result: PaymentResult & { paymentId: string }; at: number }>()

  constructor(private readonly opts: PaymentManagerOptions = {}) {}

  createAdapter(p: Params): PaymentAdapter {
    const name = str(p, 'adapter', { required: true })
    switch (name) {
      case 'simulator':
        return new SimulatorAdapter({ durationMs: this.opts.simulatorDurationMs })
      case 'caisse-ap': {
        const host = str(p, 'host', { required: true, max: 253 })!
        const mode = str(p, 'mode')
        if (mode !== undefined && mode !== 'card' && mode !== 'check') {
          throw new BridgeError('invalid_params', 'Mode de paiement invalide (card ou check).')
        }
        return new CaisseApAdapter({
          host,
          port: int(p, 'port', { min: 1, max: 65535, def: CAISSE_AP_DEFAULT_PORT }),
          posNumber: str(p, 'posNumber', { max: 2 }),
          mode,
          refund: p.refund === true,
          timeoutMs: int(p, 'timeoutMs', { min: 5000, max: 600_000, def: 180_000 }),
        })
      }
      default:
        throw new BridgeError('unknown_adapter', `Terminal de paiement inconnu : ${name}.`)
    }
  }

  async start(
    p: Params,
    emit: (e: PaymentEvent & { paymentId: string }) => void,
  ): Promise<PaymentResult & { paymentId: string }> {
    const adapter = this.createAdapter(p)
    const amountCents = int(p, 'amountCents', { required: true, min: 1, max: 99_999_999_99 })
    const currency = (str(p, 'currency', { max: 3 }) ?? 'EUR').toUpperCase()
    const reference = str(p, 'reference', { max: 64 }) ?? ''
    // La caisse peut fournir son propre identifiant pour pouvoir annuler
    // avant même d'avoir reçu la réponse
    const paymentId = str(p, 'paymentId', { max: 64 }) ?? randomUUID()

    if (this.byTarget.has(adapter.target)) {
      throw new BridgeError('payment_busy', 'Un paiement est déjà en cours sur ce terminal.')
    }
    if (this.byId.has(paymentId) || this.results.has(paymentId)) throw new BridgeError('invalid_params', 'Identifiant de paiement déjà utilisé.')

    const flight: InFlight = { paymentId, adapter }
    this.byTarget.set(adapter.target, flight)
    this.byId.set(paymentId, flight)
    try {
      emit({ paymentId, step: 'started', message: 'Paiement démarré' })
      let result: PaymentResult & { paymentId: string }
      try {
        result = { ...(await adapter.start(amountCents, currency, reference, (e) => emit({ ...e, paymentId }))), paymentId }
      } catch (err) {
        if (err instanceof BridgeError) throw err
        result = { status: 'error', message: 'Erreur interne du pont pendant le paiement.', paymentId }
      }
      this.remember(result)
      return result
    } finally {
      this.byTarget.delete(adapter.target)
      this.byId.delete(paymentId)
    }
  }

  cancel(paymentId: string): { accepted: boolean; message: string } {
    const flight = this.byId.get(paymentId)
    if (!flight) return { accepted: false, message: 'Aucun paiement en cours avec cet identifiant.' }
    return flight.adapter.cancel()
  }

  private remember(result: PaymentResult & { paymentId: string }) {
    const now = Date.now()
    for (const [id, r] of this.results) if (now - r.at > RESULT_TTL_MS) this.results.delete(id)
    this.results.set(result.paymentId, { result, at: now })
  }

  // Issue d'un paiement : en cours, terminé (avec résultat) ou inconnu
  status(paymentId: string): { state: 'pending' | 'done' | 'unknown'; result?: PaymentResult & { paymentId: string } } {
    if (this.byId.has(paymentId)) return { state: 'pending' }
    const r = this.results.get(paymentId)
    if (r && Date.now() - r.at <= RESULT_TTL_MS) return { state: 'done', result: r.result }
    return { state: 'unknown' }
  }

  get inFlight(): number {
    return this.byId.size
  }
}
