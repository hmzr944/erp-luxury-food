// Terminal simulé : permet de tester tout le parcours d'encaissement de la
// caisse sans TPE. Les montants en ,13 sont refusés exprès.

import { randomInt } from 'node:crypto'
import type { PaymentAdapter, PaymentEventSink, PaymentResult } from './types.js'

export interface SimulatorOptions {
  // Durée totale d'une transaction (2 s par défaut, réglable pour les tests)
  durationMs?: number
}

export class SimulatorAdapter implements PaymentAdapter {
  readonly name = 'simulator'
  readonly target = 'simulator'
  private abort: (() => void) | null = null
  private readonly durationMs: number

  constructor(opts: SimulatorOptions = {}) {
    this.durationMs = opts.durationMs ?? 2000
  }

  start(amountCents: number, currency: string, reference: string, onEvent: PaymentEventSink): Promise<PaymentResult> {
    const d = this.durationMs
    const steps: Array<[number, string, string]> = [
      [0, 'card_wait', 'Présentez la carte'],
      [d * 0.35, 'card_read', 'Carte lue'],
      [d * 0.6, 'pin_entered', 'Code saisi'],
      [d * 0.8, 'authorizing', 'Autorisation en cours'],
    ]
    return new Promise((resolve) => {
      const timers: NodeJS.Timeout[] = []
      const clear = () => timers.forEach(clearTimeout)
      this.abort = () => {
        clear()
        resolve({ status: 'cancelled', message: 'Paiement annulé.' })
      }
      for (const [at, step, message] of steps) {
        timers.push(setTimeout(() => onEvent({ step, message }), at))
      }
      timers.push(
        setTimeout(() => {
          this.abort = null
          if (amountCents % 100 === 13) {
            resolve({ status: 'declined', message: 'Paiement refusé (simulation).', raw: { reference } })
            return
          }
          const amount = (amountCents / 100).toFixed(2).replace('.', ',')
          resolve({
            status: 'approved',
            authorizationCode: String(randomInt(0, 1_000_000)).padStart(6, '0'),
            maskedPan: '************4242',
            cardType: 'CB sans contact (simulation)',
            transactionId: `SIM-${Date.now()}`,
            receiptText: ['*** SIMULATION ***', 'AUCUN DEBIT REEL', `MONTANT ${amount} ${currency}`, `REF ${reference}`].join('\n'),
            raw: { simulator: true, reference },
          })
        }, d),
      )
    })
  }

  cancel() {
    if (!this.abort) return { accepted: false, message: 'Aucun paiement en cours.' }
    this.abort()
    this.abort = null
    return { accepted: true, message: 'Paiement annulé.' }
  }
}
