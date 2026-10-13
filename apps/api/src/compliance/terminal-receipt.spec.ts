import { webcrypto } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'
import {
  ECDSA_PARAMS,
  ECDSA_SIGN_PARAMS,
  RECEIPT_GENESIS_HASH,
  canonicalSaleContent,
  sha256Hex,
  terminalReceiptInput,
  type SignedSaleContent,
} from '@erp/utils'
import { verifyTerminalReceipt } from './terminal-receipt'

// Reproduit ce que fait la caisse dans le navigateur
async function signLikeTerminal(keys: webcrypto.CryptoKeyPair, content: SignedSaleContent, counter = 1) {
  const fields = {
    terminalId: 'term-1',
    clientId: 'c0ffee00-0000-4000-8000-000000000001',
    counter,
    previousHash: RECEIPT_GENESIS_HASH,
    total: 870,
    signedAt: '2026-10-13T12:00:00.000Z',
  }
  const contentDigest = await sha256Hex(canonicalSaleContent(content))
  const hash = await sha256Hex(terminalReceiptInput({ ...fields, contentDigest }))
  const sig = await webcrypto.subtle.sign(ECDSA_SIGN_PARAMS, keys.privateKey, new TextEncoder().encode(hash))
  return { fields, hash, signature: Buffer.from(sig).toString('base64') }
}

describe('verifyTerminalReceipt', () => {
  let keys: webcrypto.CryptoKeyPair
  let publicKeyJwk: webcrypto.JsonWebKey
  const content: SignedSaleContent = {
    items: [{ productId: 'pull', variantId: 'pull-m', quantity: 3, unitPrice: 290, taxRate: 20 }],
    payments: [{ code: 'CARD', amount: 870 }],
  }

  beforeAll(async () => {
    keys = await webcrypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
    publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
  })

  it('accepte un ticket signé par la caisse', async () => {
    const r = await signLikeTerminal(keys, content)
    expect(await verifyTerminalReceipt({ publicKeyJwk, content, ...r })).toEqual({ ok: true })
  })

  it('détecte une ligne modifiée après signature', async () => {
    const r = await signLikeTerminal(keys, content)
    const altered = { ...content, items: [{ ...content.items[0], unitPrice: 29 }] }
    const res = await verifyTerminalReceipt({ publicKeyJwk, content: altered, ...r })
    expect(res).toEqual({ ok: false, reason: 'Empreinte du ticket incorrecte (contenu modifié)' })
  })

  it('détecte un total modifié', async () => {
    const r = await signLikeTerminal(keys, content)
    const res = await verifyTerminalReceipt({ publicKeyJwk, content, ...r, fields: { ...r.fields, total: 87 } })
    expect(res.ok).toBe(false)
  })

  it('refuse un ticket signé par une autre caisse', async () => {
    const other = await webcrypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
    const r = await signLikeTerminal(other, content)
    const res = await verifyTerminalReceipt({ publicKeyJwk, content, ...r })
    expect(res).toEqual({ ok: false, reason: 'Signature de la caisse invalide' })
  })
  it('signe aussi le nom d\'un article libre', async () => {
    const free: SignedSaleContent = {
      items: [{ productId: 'free', quantity: 1, unitPrice: 870, taxRate: 20, customName: 'Retouche, ourlet' }],
      payments: [{ code: 'CARD', amount: 870 }],
    }
    const r = await signLikeTerminal(keys, free)
    expect(await verifyTerminalReceipt({ publicKeyJwk, content: free, ...r })).toEqual({ ok: true })
    const renamed = { ...free, items: [{ ...free.items[0], customName: 'Autre chose' }] }
    expect((await verifyTerminalReceipt({ publicKeyJwk, content: renamed, ...r })).ok).toBe(false)
  })
})
