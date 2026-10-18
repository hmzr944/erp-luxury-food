import { describe, expect, it } from 'vitest'
import { ticketForSale } from './receipt-ticket'
import type { ReceiptView } from './PaymentSheet'

describe('ticketForSale', () => {
  it('imprime l’adresse de la boutique de la vente', () => {
    const view = {
      sale: {
        clientId: 'c1',
        terminalName: 'Caisse 1',
        receipt: { counter: 1, previousHash: '', hash: 'a'.repeat(64), signature: '', signedAt: '2026-10-18T10:00:00Z', total: 45 },
        pricing: { lines: [{ ht: 37.5, tax: 7.5, ttc: 45 }], subtotal: 37.5, taxAmount: 7.5, total: 45, discount: 0, taxBreakdown: [{ rate: 20, ht: 37.5, tax: 7.5 }] },
      },
      lines: [{ key: 'b', product: { id: 'b', name: 'Ceinture', price: 45, taxRate: 20 }, quantity: 1, discount: 0 }],
      payments: [{ label: 'Espèces', amount: 45 }],
    } as unknown as ReceiptView
    const t = ticketForSale(view, { siteName: 'Atelier Lin', siteAddress: '12 rue des Lilas, 69001 Lyon' })
    expect(t.shop.address).toBe('12 rue des Lilas, 69001 Lyon')
  })
})
