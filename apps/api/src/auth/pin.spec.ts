import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { ECDSA_PARAMS, ECDSA_SIGN_PARAMS } from '@erp/utils'
import { PinAttempts, pinChallenge, pinLookup, verifyTerminalSignature } from './pin'

describe('code vendeur', () => {
  it('empreinte propre à l’organisation et à la clé', () => {
    expect(pinLookup('k', 'org1', '1234')).toBe(pinLookup('k', 'org1', '1234'))
    expect(pinLookup('k', 'org1', '1234')).not.toBe(pinLookup('k', 'org2', '1234'))
    expect(pinLookup('k', 'org1', '1234')).not.toBe(pinLookup('autre', 'org1', '1234'))
  })

  it('signature de la caisse vérifiée', async () => {
    const keys = await webcrypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify'])
    const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
    const msg = pinChallenge('t1', '2026-10-13T10:00:00.000Z')
    const sig = Buffer.from(await webcrypto.subtle.sign(ECDSA_SIGN_PARAMS, keys.privateKey, new TextEncoder().encode(msg))).toString('base64')
    expect(await verifyTerminalSignature(jwk, msg, sig)).toBe(true)
    expect(await verifyTerminalSignature(jwk, pinChallenge('t2', '2026-10-13T10:00:00.000Z'), sig)).toBe(false)
  })

  it('blocage après 5 erreurs, puis reprise', () => {
    const a = new PinAttempts(5, 60_000)
    for (let i = 0; i < 4; i++) a.fail('t', 0)
    expect(a.lockedFor('t', 0)).toBe(0)
    a.fail('t', 0)
    expect(a.lockedFor('t', 1000)).toBe(1)
    expect(a.lockedFor('t', 61_000)).toBe(0)
    a.fail('t', 61_000)
    expect(a.lockedFor('t', 61_000)).toBe(0)
  })

  it('une signature ne sert qu’une fois', () => {
    const a = new PinAttempts()
    expect(a.firstUse('sig', 0)).toBe(true)
    expect(a.firstUse('sig', 1000)).toBe(false)
  })
})

import { badgeLookup, normalizeBadge, newBadgeToken } from './pin'

describe('badge vendeur', () => {
  it('QR : préfixe et jeton', () => {
    const t = newBadgeToken()
    expect(normalizeBadge(`FLOW1:${t}`)).toEqual({ kind: 'QR', value: t })
    expect(normalizeBadge('FLOW1:court')).toBeNull()
  })
  it('NFC : identifiant nettoyé quel que soit le lecteur', () => {
    expect(normalizeBadge('04:a2:2b:1a:9c:5e:80')).toEqual({ kind: 'NFC', value: '04A22B1A9C5E80' })
    expect(normalizeBadge(' 04A22B1A9C5E80\n')).toEqual({ kind: 'NFC', value: '04A22B1A9C5E80' })
    expect(normalizeBadge('bonjour')).toBeNull()
  })
  it('empreinte différente pour un QR et un NFC de même valeur', () => {
    expect(badgeLookup('k', 'o', { kind: 'QR', value: 'ABCDEF' })).not.toBe(badgeLookup('k', 'o', { kind: 'NFC', value: 'ABCDEF' }))
  })
})
