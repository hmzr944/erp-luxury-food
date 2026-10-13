import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ECDSA_PARAMS,
  ECDSA_SIGN_PARAMS,
  RECEIPT_GENESIS_HASH,
  canonicalSaleContent,
  sha256Hex,
  terminalReceiptInput,
} from '@erp/utils'
import { db } from '@/lib/offline/db'
import { recordSale, flushSales, countSales } from './terminal'
import { signSale } from './signer'

const SITE = 'site-1'
let publicKey: CryptoKey

async function installTerminal() {
  const keys = await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
  publicKey = keys.publicKey
  await db.terminals.put({
    siteId: SITE,
    terminalId: 'term-1',
    name: 'Caisse 1',
    privateKey: keys.privateKey,
    counter: 0,
    lastHash: RECEIPT_GENESIS_HASH,
  })
}

const sale = (amount: number) => ({
  items: [{ productId: 'p1', quantity: 1, unitPrice: amount, taxRate: 20 }],
  payments: [{ code: 'CARD', amount }],
  priceIncludesTax: true,
})

describe('caisse : signature locale et file de synchronisation', () => {
  beforeEach(async () => {
    await db.sales.clear()
    await db.terminals.clear()
    await installTerminal()
    vi.stubGlobal('localStorage', { getItem: () => 'token', setItem: () => {}, removeItem: () => {} })
  })

  it('signe un ticket vérifiable avec la clé publique de la caisse', async () => {
    const keys = await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
    const content = { items: sale(120).items, payments: sale(120).payments }
    const signedAt = new Date('2026-10-13T10:00:00.000Z')
    const { receipt, next } = await signSale(
      keys.privateKey,
      { terminalId: 'term-1', counter: 0, lastHash: RECEIPT_GENESIS_HASH },
      { clientId: 'c-1', content, total: 120, signedAt },
    )
    const digest = await sha256Hex(canonicalSaleContent(content))
    const expected = await sha256Hex(
      terminalReceiptInput({
        terminalId: 'term-1', clientId: 'c-1', counter: 1, previousHash: RECEIPT_GENESIS_HASH,
        total: 120, signedAt: signedAt.toISOString(), contentDigest: digest,
      }),
    )
    expect(receipt.hash).toBe(expected)
    expect(next).toEqual({ terminalId: 'term-1', counter: 1, lastHash: expected })
    const sig = Uint8Array.from(atob(receipt.signature), (c) => c.charCodeAt(0))
    expect(await crypto.subtle.verify(ECDSA_SIGN_PARAMS, keys.publicKey, sig, new TextEncoder().encode(receipt.hash))).toBe(true)
  })

  it('hors ligne : les ventes sont signées, chaînées et gardées sur l\'appareil', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const a = await recordSale(SITE, sale(120))
    const b = await recordSale(SITE, sale(45.5))
    expect(a.receipt.counter).toBe(1)
    expect(b.receipt.counter).toBe(2)
    expect(b.receipt.previousHash).toBe(a.receipt.hash)
    const sig = Uint8Array.from(atob(b.receipt.signature), (c) => c.charCodeAt(0))
    expect(await crypto.subtle.verify(ECDSA_SIGN_PARAMS, publicKey, sig, new TextEncoder().encode(b.receipt.hash))).toBe(true)
    await flushSales(SITE)
    expect(await countSales(SITE)).toEqual({ pending: 2, rejected: 0 })
  })

  it('au retour du réseau : envoi dans l\'ordre des tickets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await recordSale(SITE, sale(10))
    await recordSale(SITE, sale(20))
    await flushSales(SITE)

    const sent: number[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)).receipt.counter)
        return new Response(JSON.stringify({ id: `order-${sent.length}` }), { status: 200 })
      }),
    )
    const r = await flushSales(SITE)
    expect(sent).toEqual([1, 2])
    expect(r).toEqual({ synced: 2, rejected: 0, remaining: 0 })
  })

  it('refuse d\'encaisser si les paiements ne couvrent pas le total', async () => {
    await expect(
      recordSale(SITE, { ...sale(100), payments: [{ code: 'CARD', amount: 90 }] }),
    ).rejects.toThrow('ne correspond pas')
    expect(await db.terminals.get(SITE)).toMatchObject({ counter: 0 })
  })

  it('un refus serveur est mis de côté sans bloquer les ventes suivantes à envoyer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await recordSale(SITE, sale(10))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: ['Signature de la caisse invalide'] }), { status: 422 })),
    )
    const r = await flushSales(SITE)
    expect(r.rejected).toBe(1)
    const [rejected] = await db.sales.toArray()
    expect(rejected).toMatchObject({ status: 'rejected', error: 'Signature de la caisse invalide' })
  })
})
