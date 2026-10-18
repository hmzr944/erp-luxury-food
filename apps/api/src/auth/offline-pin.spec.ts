import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ECDSA_PARAMS, ECDSA_SIGN_PARAMS } from '@erp/utils'
import { AuthService, offlineMoment } from './auth.service'
import { offlineChallenge, offlineTerminalSalt, offlineUserSalt, pinChallenge, pinLookup } from './pin'

const SECRET = 'secret-de-test'

async function terminalKeys() {
  const keys = await webcrypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify'])
  const jwk = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
  const sign = async (msg: string) =>
    Buffer.from(await webcrypto.subtle.sign(ECDSA_SIGN_PARAMS, keys.privateKey, new TextEncoder().encode(msg))).toString('base64')
  return { jwk, sign }
}

const seller = {
  id: 'u-seller',
  email: 'lea@boutique.test',
  firstName: 'Léa',
  lastName: 'Martin',
  role: 'SELLER',
  organizationId: 'org1',
  tokenVersion: 0,
  pinLookup: pinLookup(SECRET, 'org1', '1234'),
  sites: [{ siteId: 'site1' }],
}

async function setup(opts: { active?: boolean; terminalOrg?: string } = {}) {
  const keys = await terminalKeys()
  const terminal = { id: 'term1', siteId: 'site1', publicKey: JSON.stringify(keys.jwk), isActive: opts.active ?? true, site: { organizationId: opts.terminalOrg ?? 'org1' } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    terminal: { findUnique: vi.fn(async () => terminal) },
    user: {
      findUnique: vi.fn(async () => seller),
      findMany: vi.fn(async () => [
        { id: 'u-seller', firstName: 'Léa', lastName: 'Martin', role: 'SELLER', organizationId: 'org1', tokenVersion: 0, pinLookup: seller.pinLookup },
        { id: 'u-manager', firstName: 'Paul', lastName: 'Durand', role: 'MANAGER', organizationId: 'org1', tokenVersion: 3, pinLookup: pinLookup(SECRET, 'org1', '9876') },
      ]),
    },
    userSite: { findUnique: vi.fn(async () => ({ siteId: 'site1' })) },
  }
  const jwt = { sign: vi.fn(() => 'jeton') }
  const config = { get: vi.fn((k: string) => (k === 'PIN_SECRET' ? SECRET : undefined)), getOrThrow: vi.fn(() => 'x') }
  const audit = { log: vi.fn(async () => undefined) }
  const service = new AuthService(prisma, jwt as never, config as never, {} as never, audit as never, {} as never)
  const proof = async (challenge = offlineChallenge) => {
    const signedAt = new Date().toISOString()
    return { terminalId: 'term1', signedAt, signature: await keys.sign(challenge('term1', signedAt)) }
  }
  return { service, prisma, audit, proof }
}

describe('sels de reprise sans réseau', () => {
  it('liés à la caisse, au code et aux sessions de la personne', () => {
    const u = { id: 'u1', pinLookup: 'abc', tokenVersion: 0 }
    expect(offlineUserSalt('k', 't1', u)).toBe(offlineUserSalt('k', 't1', u))
    expect(offlineUserSalt('k', 't1', u)).not.toBe(offlineUserSalt('k', 't2', u))
    expect(offlineUserSalt('k', 't1', u)).not.toBe(offlineUserSalt('k', 't1', { ...u, pinLookup: 'abd' }))
    expect(offlineUserSalt('k', 't1', u)).not.toBe(offlineUserSalt('k', 't1', { ...u, tokenVersion: 1 }))
    expect(offlineUserSalt('k', 't1', u)).not.toBe(offlineUserSalt('autre', 't1', u))
    expect(offlineTerminalSalt('k', 't1')).not.toBe(offlineTerminalSalt('k', 't2'))
  })

  it('heure de reprise gardée seulement si plausible', () => {
    const now = Date.parse('2026-10-18T12:00:00Z')
    expect(offlineMoment('2026-10-18T11:05:00Z', now)).toBe('18/10/2026 à 13:05')
    expect(offlineMoment('2026-10-19T12:00:00Z', now)).toBeNull()
    expect(offlineMoment('2026-09-01T12:00:00Z', now)).toBeNull()
    expect(offlineMoment(undefined, now)).toBeNull()
  })
})

describe('connexion par code : de quoi reprendre sans réseau', () => {
  it('renvoie les sels de la caisse, jamais l’empreinte du code', async () => {
    const { service, proof } = await setup()
    const res = await service.pinLogin({ ...(await proof(pinChallenge)), pin: '1234' })
    expect(res.offline).toEqual({
      terminalSalt: offlineTerminalSalt(SECRET, 'term1'),
      salt: offlineUserSalt(SECRET, 'term1', { id: 'u-seller', pinLookup: seller.pinLookup, tokenVersion: 0 }),
    })
    const json = JSON.stringify(res)
    expect(json).not.toContain(seller.pinLookup)
    expect(json).not.toContain('tokenVersion')
    expect(json).not.toContain('1234')
  })

  it('note la reprise sans réseau au journal quand elle est confirmée', async () => {
    const { service, proof, audit } = await setup()
    const offlineAt = new Date(Date.now() - 10 * 60_000).toISOString()
    await service.pinLogin({ ...(await proof(pinChallenge)), pin: '1234', offlineAt })
    // Sans la personne attendue, l'heure seule n'est pas notée
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.till_offline_unlock' }))
    await service.pinLogin({ ...(await proof(pinChallenge)), pin: '1234', offlineAt, offlineUserId: 'u-seller' })
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.till_login', userId: 'u-seller' }))
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.till_offline_unlock', userId: 'u-seller', terminalId: 'term1' }))
  })

  it('code passé à quelqu’un d’autre depuis la reprise : refusé, pas de session', async () => {
    const { service, proof, audit } = await setup()
    await expect(service.pinLogin({ ...(await proof(pinChallenge)), pin: '1234', offlineAt: new Date().toISOString(), offlineUserId: 'u-autre' })).rejects.toBeInstanceOf(UnauthorizedException)
    // Le journal nomme le vrai titulaire du code, jamais l'identifiant envoyé par la caisse
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.till_refused', userId: 'u-seller' }))
    expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.till_login' }))
  })

  it('atelier : pas de reprise sans réseau', async () => {
    const { service, proof, prisma } = await setup()
    prisma.user.findUnique.mockResolvedValue({ ...seller, role: 'PRODUCTION' })
    const res = await service.pinLogin({ ...(await proof(pinChallenge)), pin: '1234' })
    expect(res.offline).toBeUndefined()
  })

  it('badge : pas de sels (aucun code tapé)', async () => {
    const { service, proof, prisma } = await setup()
    prisma.user.findUnique.mockResolvedValue({ ...seller, badgeLookup: 'b' })
    const res = await service.badgeLogin({ ...(await proof(pinChallenge)), code: 'FLOW1:ABCDEFGHJKLMNPQRSTUV' })
    expect(res.offline).toBeUndefined()
  })
})

describe('équipe reconnue sans réseau', () => {
  const caller = { id: 'u-seller', organizationId: 'org1', role: 'SELLER' }

  it('vendeur rattaché à la boutique : équipe du site, sans aucun secret', async () => {
    const { service, proof, prisma } = await setup()
    const res = await service.offlineRoster(caller, await proof())
    expect(res.active).toBe(true)
    expect(res.terminalSalt).toBe(offlineTerminalSalt(SECRET, 'term1'))
    expect(res.users.map((u) => u.id)).toEqual(['u-seller', 'u-manager'])
    expect(res.users[1].salt).toBe(offlineUserSalt(SECRET, 'term1', { id: 'u-manager', pinLookup: pinLookup(SECRET, 'org1', '9876'), tokenVersion: 3 }))
    // Organisation de la caisse, rôles de vente, vendeurs du site seulement
    const where = prisma.user.findMany.mock.calls[0][0].where
    expect(where.organizationId).toBe('org1')
    expect(where.pinLookup).toEqual({ not: null })
    expect(where.OR).toEqual([{ role: { in: ['OWNER', 'MANAGER'] } }, { role: 'SELLER', sites: { some: { siteId: 'site1' } } }])
    const json = JSON.stringify(res)
    expect(json).not.toContain(seller.pinLookup)
    expect(json).not.toMatch(/pinLookup|tokenVersion|email|passwordHash|badge/)
  })

  it('signature absente, rejouée ou d’une autre demande : refusé', async () => {
    const { service, proof } = await setup()
    await expect(service.offlineRoster(caller, { ...(await proof()), signature: 'AAAA' })).rejects.toBeInstanceOf(UnauthorizedException)
    // Une signature de connexion par code ne vaut pas pour la liste
    await expect(service.offlineRoster(caller, await proof(pinChallenge))).rejects.toBeInstanceOf(UnauthorizedException)
    const once = await proof()
    await service.offlineRoster(caller, once)
    await expect(service.offlineRoster(caller, once)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('caisse d’une autre organisation : refusé', async () => {
    const { service, proof } = await setup({ terminalOrg: 'org2' })
    await expect(service.offlineRoster(caller, await proof())).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('vendeur non rattaché à la boutique : refusé ; gérant : accepté', async () => {
    const { service, proof, prisma } = await setup()
    prisma.userSite.findUnique.mockResolvedValue(null)
    await expect(service.offlineRoster(caller, await proof())).rejects.toBeInstanceOf(ForbiddenException)
    const res = await service.offlineRoster({ id: 'u-manager', organizationId: 'org1', role: 'MANAGER' }, await proof())
    expect(res.users).toHaveLength(2)
  })

  it('caisse désactivée : liste vide, la caisse efface ce qu’elle avait', async () => {
    const { service, proof, prisma } = await setup({ active: false })
    const res = await service.offlineRoster(caller, await proof())
    expect(res).toMatchObject({ active: false, terminalSalt: null, users: [] })
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })
})
