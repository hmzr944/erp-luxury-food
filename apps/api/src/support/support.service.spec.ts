import { describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { SupportService } from './support.service'
import { SupportConfig } from './support.config'
import { compareQueue, isOverdue, type QueueItem } from './support-queue'

const env = (values: Record<string, string>) => new SupportConfig({ get: (k: string) => values[k] } as never)
const BASE = { SUPPORT_HOURS: 'lun-sam 08:00-20:00', SUPPORT_TEAM_EMAILS: 'equipe@flow.test', SUPPORT_AGENT_EMAILS: 'agent@flow.test' }

function setup(values: Record<string, string> = BASE) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    organization: { findUnique: vi.fn(async () => ({ subscriptionStatus: 'TRIALING', trialEndsAt: new Date('2026-11-01'), name: 'Maison' })), findMany: vi.fn(async () => []) },
    user: { findUnique: vi.fn(async () => ({ firstName: 'Léa', lastName: 'Martin', email: 'lea@boutique.test' })), findMany: vi.fn(async () => [{ id: 'u1', firstName: 'Léa', lastName: 'Martin', email: 'lea@boutique.test', role: 'SELLER' }]) },
    site: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    supportThread: { create: vi.fn(async () => ({ id: 't1' })), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    supportMessage: { create: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mail: any = { send: vi.fn(async () => ({ sent: false, reason: 'off' })) }
  const audit = { log: vi.fn(async () => undefined) }
  const service = new SupportService(prisma as never, mail as never, audit as never, env(values))
  return { prisma, mail, audit, service }
}

const user = { id: 'u1', role: 'SELLER', organizationId: 'org1' }

describe('SupportService', () => {
  it('annonce la promesse tirée de la configuration, et le contact d’essai seulement s’il existe', async () => {
    const { service } = setup()
    const s = await service.status(user, new Date('2026-10-18T10:00:00Z')) // dimanche
    expect(s.promise).toBe('Réponse sous 2 h, du lundi au samedi de 8 h à 20 h')
    expect(s.urgentPromise).toBe('Réponse sous 30 min, du lundi au samedi de 8 h à 20 h')
    expect(s.openNow).toBe(false)
    expect(s.nextOpenAt).toBe('2026-10-19T06:00:00.000Z')
    expect(s.trialContact).toBeNull()
    expect(s.isAgent).toBe(false)

    const named = setup({ ...BASE, SUPPORT_TRIAL_CONTACT_NAME: 'Camille' })
    expect((await named.service.status(user, new Date('2026-10-15T08:00:00Z'))).trialContact).toEqual({ name: 'Camille', phone: null })
  })

  it('horaires illisibles : aucun délai annoncé plutôt qu’un faux', async () => {
    const { service } = setup({ ...BASE, SUPPORT_HOURS: 'du lundi au samedi' })
    const s = await service.status(user)
    expect(s.promise).toBeNull()
    expect(s.slaMinutes).toBeNull()
  })

  it('crée une demande urgente : échéance courte, équipe prévenue, audit', async () => {
    const { service, prisma, mail, audit } = setup()
    prisma.supportThread.findFirst.mockResolvedValue({ id: 't1', status: 'OPEN', dueAt: new Date(), messages: [] })
    prisma.supportThread.findUnique.mockResolvedValue({ id: 't1', organizationId: 'org1', userId: 'u1', siteId: null, subject: 'TPE', priority: 'URGENT', status: 'OPEN', dueAt: new Date('2026-10-15T08:30:00Z'), context: { online: false }, messages: [{ body: 'Le TPE ne répond plus' }] })
    await service.create(user, { subject: 'TPE', body: 'Le TPE ne répond plus', priority: 'URGENT', context: { online: false } }, new Date('2026-10-15T08:00:00Z'))
    const data = prisma.supportThread.create.mock.calls[0][0].data
    expect(data.dueAt.toISOString()).toBe('2026-10-15T08:30:00.000Z')
    expect(data.organizationId).toBe('org1')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'support.urgent_created' }))
    await vi.waitFor(() => expect(mail.send).toHaveBeenCalled())
    expect(mail.send.mock.calls[0][0]).toMatchObject({ to: ['equipe@flow.test'], subject: '[URGENT] Nouvelle demande : TPE', replyTo: 'lea@boutique.test' })
  })

  it('ne montre jamais la demande d’une autre organisation', async () => {
    const { service, prisma } = setup()
    prisma.supportThread.findFirst.mockResolvedValue(null)
    await expect(service.get('org2', 't1')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.supportThread.findFirst.mock.calls[0][0].where).toEqual({ id: 't1', organizationId: 'org2' })
    await expect(service.post({ ...user, organizationId: 'org2' }, 't1', 'Bonjour')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('première réponse de l’équipe : délai tenu ou non, commerçant prévenu', async () => {
    const { service, prisma, mail } = setup()
    prisma.supportThread.findUnique.mockResolvedValue({ id: 't1', organizationId: 'org1', userId: 'u1', siteId: null, subject: 'Imprimante', dueAt: new Date('2026-10-15T10:00:00Z'), firstResponseAt: null, status: 'OPEN', messages: [] })
    await service.agentReply({ id: 'a1', role: 'OWNER', organizationId: 'flow' }, 't1', { body: 'Bonjour, on regarde.' }, new Date('2026-10-15T09:00:00Z'))
    expect(prisma.supportThread.update.mock.calls[0][0].data).toMatchObject({ status: 'WAITING_CUSTOMER', slaMet: true })
    await vi.waitFor(() => expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'lea@boutique.test' })))

    const late = setup()
    late.prisma.supportThread.findUnique.mockResolvedValue({ id: 't1', organizationId: 'org1', userId: 'u1', siteId: null, subject: 'x', dueAt: new Date('2026-10-15T10:00:00Z'), firstResponseAt: null, status: 'OPEN', messages: [] })
    await late.service.agentReply({ id: 'a1', role: 'OWNER', organizationId: 'flow' }, 't1', { body: 'Désolé du retard' }, new Date('2026-10-15T11:00:00Z'))
    expect(late.prisma.supportThread.update.mock.calls[0][0].data).toMatchObject({ slaMet: false })
  })

  it('un message du commerçant après la réponse rouvre la demande avec une nouvelle échéance', async () => {
    const { service, prisma } = setup()
    prisma.supportThread.findFirst.mockResolvedValue({ id: 't1', status: 'WAITING_CUSTOMER', priority: 'NORMAL', dueAt: new Date('2026-10-14T10:00:00Z'), messages: [] })
    await service.post(user, 't1', 'Toujours pas', new Date('2026-10-15T08:00:00Z'))
    expect(prisma.supportThread.update.mock.calls[0][0].data).toMatchObject({ status: 'OPEN', dueAt: new Date('2026-10-15T10:00:00Z') })
  })

  it('reconnaît l’équipe par l’e-mail relu en base', async () => {
    const { service, prisma } = setup()
    prisma.user.findUnique.mockResolvedValueOnce({ email: 'Agent@Flow.test' } as never)
    expect(await service.isAgent('a1')).toBe(true)
    expect(await service.isAgent('u1')).toBe(false)
  })
})

describe('file de l’équipe', () => {
  const t = (status: QueueItem['status'], priority: QueueItem['priority'], due: string, last = due): QueueItem => ({ status, priority, dueAt: new Date(due), lastMessageAt: new Date(last) })
  it('urgences d’abord, puis échéance la plus proche, puis le reste', () => {
    const items = [
      t('WAITING_CUSTOMER', 'URGENT', '2026-10-15T08:00:00Z'),
      t('OPEN', 'NORMAL', '2026-10-15T09:00:00Z'),
      t('OPEN', 'URGENT', '2026-10-15T12:00:00Z'),
      t('OPEN', 'NORMAL', '2026-10-15T08:00:00Z'),
      t('RESOLVED', 'NORMAL', '2026-10-14T08:00:00Z'),
    ]
    const sorted = [...items].sort(compareQueue)
    expect(sorted.map((x) => `${x.status}/${x.priority}/${x.dueAt.getUTCHours()}`)).toEqual([
      'OPEN/URGENT/12',
      'OPEN/NORMAL/8',
      'OPEN/NORMAL/9',
      'WAITING_CUSTOMER/URGENT/8',
      'RESOLVED/NORMAL/8',
    ])
  })
  it('en retard seulement si l’équipe doit encore répondre', () => {
    const now = new Date('2026-10-15T10:00:00Z')
    expect(isOverdue(t('OPEN', 'NORMAL', '2026-10-15T09:00:00Z'), now)).toBe(true)
    expect(isOverdue(t('WAITING_CUSTOMER', 'NORMAL', '2026-10-15T09:00:00Z'), now)).toBe(false)
  })
})
