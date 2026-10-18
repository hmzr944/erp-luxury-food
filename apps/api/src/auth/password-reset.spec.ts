import { describe, expect, it, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { PasswordResetService, RESET_TTL_MS, newResetToken, resetTokenHash } from './password-reset.service'
import { RegisterDto } from './dto/register.dto'

const NOW = new Date('2026-10-18T10:00:00.000Z')

type Row = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; user: { organizationId: string } }

function setup(rows: Row[] = [], opts: { user?: boolean } = {}) {
  const user = { id: 'u1', email: 'lea@boutique.test', firstName: 'Léa', organizationId: 'org1' }
  const userUpdate = vi.fn(async () => ({}))
  const passwordReset = {
    findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null),
    // Réservation atomique : seulement si le lien est encore libre et valable
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => {
      const r = rows.find((x) => x.id === where.id && !x.usedAt && x.expiresAt > where.expiresAt.gt)
      if (r) r.usedAt = data.usedAt
      return { count: r ? 1 : 0 }
    }),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'usedAt' | 'user'> }) => {
      rows.push({ ...data, id: `r${rows.length + 1}`, usedAt: null, user: { organizationId: 'org1' } })
    }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    user: { findUnique: vi.fn(async () => (opts.user === false ? null : user)) },
    passwordReset,
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? arg({ passwordReset, user: { update: userUpdate } }) : Promise.all(arg as Promise<unknown>[]),
    ),
  }
  const mail = { send: vi.fn(async () => ({ sent: true })) }
  const config = { get: vi.fn(() => 'https://flow.test') }
  const audit = { log: vi.fn(async () => undefined) }
  const auth = { hashPassword: vi.fn(async (p: string) => `hash:${p}`) }
  const service = new PasswordResetService(prisma, mail as never, config as never, audit as never, auth as never)
  return { service, prisma, rows, mail, audit, userUpdate }
}

function rowFor(token: string, patch: Partial<Row> = {}): Row {
  return { id: 'r1', userId: 'u1', tokenHash: resetTokenHash(token), expiresAt: new Date(NOW.getTime() + RESET_TTL_MS), usedAt: null, user: { organizationId: 'org1' }, ...patch }
}

describe('jeton de mot de passe oublié', () => {
  it('aléatoire, 32 octets, seule son empreinte SHA-256 est gardée', () => {
    const a = newResetToken()
    const b = newResetToken()
    expect(a.token).not.toBe(b.token)
    expect(Buffer.from(a.token, 'base64url')).toHaveLength(32)
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.tokenHash).toBe(resetTokenHash(a.token))
    expect(a.tokenHash).not.toContain(a.token)
  })

  it('envoie un lien valable une heure, sans garder le jeton en clair', async () => {
    const { service, rows, mail, audit } = setup()
    await service.sendLink('  Lea@Boutique.test ', NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0].expiresAt.getTime() - NOW.getTime()).toBe(RESET_TTL_MS)
    const text = (mail.send.mock.calls[0] as unknown as [{ text: string }])[0].text
    const token = /token=([\w-]+)/.exec(text)![1]
    expect(text).toContain('https://flow.test/mot-de-passe/nouveau?token=')
    expect(rows[0].tokenHash).toBe(resetTokenHash(token))
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_reset_requested' }))
  })

  it('compte inconnu : rien n’est créé ni envoyé', async () => {
    const { service, rows, mail } = setup([], { user: false })
    await service.sendLink('personne@nulle.part', NOW)
    expect(rows).toHaveLength(0)
    expect(mail.send).not.toHaveBeenCalled()
  })

  it('succès : nouveau mot de passe haché et sessions révoquées', async () => {
    const { service, rows, userUpdate, audit } = setup([rowFor('bon-jeton')])
    await service.reset('bon-jeton', 'nouveau-mot-de-passe', NOW)
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hash:nouveau-mot-de-passe', tokenVersion: { increment: 1 } } })
    expect(rows[0].usedAt).toEqual(NOW)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_reset', userId: 'u1' }))
  })

  it('mauvais jeton refusé', async () => {
    const { service, userUpdate } = setup([rowFor('bon-jeton')])
    await expect(service.reset('mauvais-jeton', 'nouveau-mot-de-passe', NOW)).rejects.toBeInstanceOf(BadRequestException)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('jeton expiré refusé', async () => {
    const { service, userUpdate } = setup([rowFor('bon-jeton', { expiresAt: new Date(NOW.getTime() - 1) })])
    await expect(service.reset('bon-jeton', 'nouveau-mot-de-passe', NOW)).rejects.toBeInstanceOf(BadRequestException)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('jeton déjà utilisé refusé, même juste après', async () => {
    const { service, userUpdate } = setup([rowFor('bon-jeton')])
    await service.reset('bon-jeton', 'nouveau-mot-de-passe', NOW)
    await expect(service.reset('bon-jeton', 'autre-mot-de-passe', NOW)).rejects.toBeInstanceOf(BadRequestException)
    expect(userUpdate).toHaveBeenCalledTimes(1)
  })

  it('deux ouvertures simultanées : une seule passe', async () => {
    const { service, userUpdate } = setup([rowFor('bon-jeton')])
    const results = await Promise.allSettled([service.reset('bon-jeton', 'premier-mot-de-passe', NOW), service.reset('bon-jeton', 'second-mot-de-passe', NOW)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(userUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('conditions à l’inscription', () => {
  const base = { sector: 'GENERAL', businessName: 'Maison Test', email: 'lea@boutique.test', password: 'mot-de-passe-long' }

  it('acceptation obligatoire', async () => {
    for (const acceptTerms of [undefined, false, 'oui']) {
      const errors = await validate(plainToInstance(RegisterDto, { ...base, acceptTerms }))
      expect(errors.map((e) => e.property)).toContain('acceptTerms')
    }
    expect(await validate(plainToInstance(RegisterDto, { ...base, acceptTerms: true }))).toHaveLength(0)
  })
})
