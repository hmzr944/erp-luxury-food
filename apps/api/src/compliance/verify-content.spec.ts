import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { canonicalSaleContent, ledgerEntryInput, ledgerEntryInputV1, stableStringify } from '@erp/utils'
import { draftContent, type OrderDraft } from '../orders/order-draft'
import { ComplianceService } from './compliance.service'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const D = (v: number | string) => new Decimal(v)

// Chaîne d'un site : chaque maillon est scellé comme à la signature
function buildChain(entries: Array<{ total: number; kind?: 'SALE' | 'REFUND'; terminalId?: string | null; content: string; order: any }>) {
  const receipts: any[] = []
  const orders: any[] = []
  let prev = '0'.repeat(64)
  let perp = D(0)
  let abs = D(0)
  entries.forEach((e, i) => {
    const total = D(e.total)
    perp = perp.add(total)
    abs = abs.add(total.abs())
    const kind = e.kind ?? 'SALE'
    const digest = sha(e.content)
    const row: any = {
      id: `r${i + 1}`, siteId: 's', counter: i + 1, version: 2, kind, total, perpetualTotal: perp, perpetualAbsTotal: abs,
      signedAt: new Date(`2026-10-14T10:0${i}:00.000Z`), previousHash: prev, contentDigest: digest,
      terminalId: e.terminalId ?? null, terminalSignature: null, hash: '',
    }
    row.hash = sha(ledgerEntryInput({
      previousHash: prev, counter: row.counter, signedAt: row.signedAt.toISOString(), siteId: 's', terminalId: row.terminalId,
      kind, total: total.toFixed(2), perpetualTotal: perp.toFixed(2), perpetualAbsTotal: abs.toFixed(2), contentDigest: digest,
    }))
    prev = row.hash
    receipts.push(row)
    orders.push({ receiptChainId: row.id, kind, total, refundOfId: null, discount: D(0), ...e.order })
  })
  return { receipts, orders }
}

function service(receipts: any[], orders: any[]) {
  const prisma: any = {
    receiptChain: { findMany: async () => receipts, findUnique: async () => null, findFirst: async () => null },
    order: { findMany: async ({ where }: any) => orders.filter((o) => where.receiptChainId.in.includes(o.receiptChainId)) },
  }
  return new ComplianceService(prisma)
}

const line = (over: any = {}) => ({
  id: 'i1', refundOfItemId: null, productId: 'p1', variantId: null, name: 'Croissant', variantName: null, serialNumber: null,
  price: D('1.50'), taxRate: D('10'), quantity: 2, discount: D('0'), modifiers: null, menuProductId: null, menuName: null,
  menuGroup: null, weight: null, scaleLabel: null, product: { isCustom: false }, ...over,
})
const pay = (over: any = {}) => ({ id: 'y1', code: 'CASH', kind: 'CASH', amount: D('3.00'), reference: null, ...over })

// Vente signée par une caisse
const terminalContent = () => canonicalSaleContent({
  items: [
    { productId: 'p1', quantity: 2, unitPrice: 1.5, taxRate: 10 },
    { productId: 'p2', quantity: 1, unitPrice: 4, taxRate: 5.5, discount: 0.5, modifiers: ['m1', 'm2'], customName: undefined },
  ],
  payments: [{ code: 'CARD', amount: 6.5 }],
  orderDiscount: 0,
})
const terminalOrder = () => ({
  total: D('6.50'),
  items: [
    line({ id: 'i1' }),
    line({ id: 'i2', productId: 'p2', name: 'Café', price: D('4'), taxRate: D('5.5'), quantity: 1, discount: D('0.5'), modifiers: [{ id: 'm1', name: 'Lait', price: 0 }, { id: 'm2', name: 'Sucre', price: 0 }] }),
  ],
  payments: [pay({ code: 'CARD', kind: 'CARD', amount: D('6.50') })],
})

describe('Vérification du contenu des ventes', () => {
  it('contenu intact (vente de caisse) : chaîne valide, contenu vérifié', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    const r = await service(receipts, orders).verifyChain('s')
    expect(r.errors).toEqual([])
    expect(r.valid).toBe(true)
    expect(r.contentChecked).toBe(1)
  })

  it('une ligne modifiée après la signature est détectée', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    orders[0].items[0] = line({ id: 'i1', price: D('1.00') })
    const r = await service(receipts, orders).verifyChain('s')
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('Contenu altéré au ticket n° 1')
  })

  it('une quantité ou une ligne supprimée ou ajoutée est détectée', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    orders[0].items[0] = line({ id: 'i1', quantity: 3 })
    expect((await service(receipts, orders).verifyChain('s')).errors).toContain('Contenu altéré au ticket n° 1')
    orders[0].items = [orders[0].items[1]]
    expect((await service(receipts, orders).verifyChain('s')).errors).toContain('Contenu altéré au ticket n° 1')
  })

  it('un paiement modifié est détecté', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    orders[0].payments = [pay({ code: 'CASH', kind: 'CASH', amount: D('6.50') })]
    const r = await service(receipts, orders).verifyChain('s')
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('Contenu altéré au ticket n° 1')
  })

  it('le montant de la vente doit être celui du ticket', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    orders[0].total = D('0.50')
    const r = await service(receipts, orders).verifyChain('s')
    expect(r.errors.join(' ')).toMatch(/Contenu altéré au ticket n° 1 \(montant/)
  })

  it('référence TPE rattachée par le serveur après la signature : contenu intact', async () => {
    const { receipts, orders } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    orders[0].payments = [pay({ code: 'CARD', kind: 'CARD', amount: D('6.50'), reference: 'pi_123' })]
    expect((await service(receipts, orders).verifyChain('s')).valid).toBe(true)
  })

  it('vente encaissée par le serveur : intacte, puis modifiée', async () => {
    const draft = {
      items: [{ productId: 'p1', variantId: null, name: 'Croissant', variantName: null, serialNumber: null, price: 1.5, taxRate: 10, quantity: 2, discount: 0, modifiers: null, menuProductId: null, menuName: null, menuGroup: null, weight: null, pricePerKg: null, scaleLabel: null }],
      payments: [{ code: 'CASH', label: 'Espèces', kind: 'CASH', amount: 3 }],
      pricing: { discount: 0, total: 3 },
    } as unknown as OrderDraft
    const { receipts, orders } = buildChain([{ total: 3, content: draftContent(draft), order: { total: D('3.00'), items: [line()], payments: [pay()] } }])
    expect((await service(receipts, orders).verifyChain('s')).valid).toBe(true)
    orders[0].items = [line({ discount: D('0.50') })]
    expect((await service(receipts, orders).verifyChain('s')).errors).toContain('Contenu altéré au ticket n° 1')
  })

  it('remboursement : intact avec un arrondi par ligne, modifié sinon', async () => {
    // 3 articles remboursés pour 10,00 € : prix unitaire arrondi 3,33 €
    const content = stableStringify({
      refundOf: 'sale1',
      lines: [{ orderItemId: 'src1', quantity: 3, ttc: '10.00', taxRate: '10.00' }],
      payment: { code: 'CASH', amount: '-10.00', reference: null },
    })
    const order = {
      kind: 'REFUND', refundOfId: 'sale1', total: D('-10.00'),
      items: [line({ id: 'ri1', refundOfItemId: 'src1', price: D('-3.33'), quantity: 3 })],
      payments: [pay({ amount: D('-10.00') })],
    }
    const { receipts, orders } = buildChain([{ total: -10, kind: 'REFUND', content, order }])
    expect((await service(receipts, orders).verifyChain('s')).valid).toBe(true)
    orders[0].items = [line({ id: 'ri1', refundOfItemId: 'src1', price: D('-3.00'), quantity: 3 })]
    expect((await service(receipts, orders).verifyChain('s')).errors).toContain('Contenu altéré au ticket n° 1')
  })

  it('ancien ticket (version 1, sans empreinte de contenu) : accepté, signalé non vérifié', async () => {
    const row: any = {
      id: 'r1', siteId: 's', counter: 1, version: 1, kind: null, total: D(12), perpetualTotal: null, perpetualAbsTotal: null,
      signedAt: new Date('2026-10-01T10:00:00.000Z'), previousHash: '0'.repeat(64), contentDigest: null, terminalId: null, terminalSignature: null, hash: '',
    }
    row.hash = sha(ledgerEntryInputV1({ previousHash: row.previousHash, total: row.total.toString(), signedAt: row.signedAt.toISOString(), counter: 1 }))
    const r = await service([row], []).verifyChain('s')
    expect(r.valid).toBe(true)
    expect(r.contentChecked).toBe(0)
    expect(r.contentNotChecked).toBe(1)
  })

  it('vente supprimée : signalée', async () => {
    const { receipts } = buildChain([{ total: 6.5, terminalId: 't1', content: terminalContent(), order: terminalOrder() }])
    const r = await service(receipts, []).verifyChain('s')
    expect(r.errors).toContain('Vente introuvable pour le ticket n° 1')
  })
})
