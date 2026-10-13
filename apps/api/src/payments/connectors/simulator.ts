import { randomUUID } from 'node:crypto'
import type { PaymentConnector } from './types'

// TPE virtuel : pour essayer le parcours sans matériel ni compte. Le résultat
// est donné depuis l'écran « TPE virtuel » (un téléphone peut jouer le TPE).
export const simulatorConnector: PaymentConnector = {
  async verify() {
    return { testMode: true, label: 'TPE virtuel' }
  },
  async pair() {
    return { externalId: `sim_${randomUUID().slice(0, 8)}` }
  },
  async start() {
    return { providerRef: `simpay_${randomUUID()}` }
  },
  // L'état fait foi en base : c'est l'écran du TPE virtuel qui le change
  async status() {
    return { status: 'PENDING' }
  },
  async cancel() {},
  async refund() {
    return { refundRef: `simrefund_${randomUUID()}` }
  },
}
