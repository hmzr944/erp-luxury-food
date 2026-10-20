import { describe, expect, it, vi } from 'vitest'
import { BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { RefundsService } from './refunds.service'
import { ManagerAuthorization } from '../auth/manager-authorization'
import { pinLookup } from '../auth/pin'

const SECRET = 'cle-de-test'
const ORG = 'org1'
const users = {
  manager: { id: 'm1', firstName: 'Marie', lastName: 'Durand', role: 'MANAGER', pin: '1111' },
  owner: { id: 'o1', firstName: 'Olivier', lastName: 'Martin', role: 'OWNER', pin: '2222' },
  seller: { id: 's1', firstName: 'Léa', lastName: 'Petit', role: 'SELLER', pin: '3333' },
  seller2: { id: 's2', firstName: 'Paul', lastName: 'Roux', role: 'SELLER', pin: '4444' },
}

// Vente d'une robe à 100 € (x2 = 200 €) payée par carte sur un TPE connecté
function setup(opts: { quantity?: number; providerFails?: boolean; createFails?: boolean; payment?: 'card' | 'cash' } = {}) {
  const quantity = opts.quantity ?? 2
  const refunds: Array<Record<string, any>> = [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const sale = {
    id: 'sale1',
    siteId: 'site1',
    kind: 'SALE',
    status: 'COMPLETED',
    channel: 'IN_STORE',
    paymentMode: opts.payment === 'cash' ? 'CASH' : 'CARD',
    customerEmail: null,
    total: new Decimal(100 * quantity),
    items: [{ id: 'i1', productId: 'p1', variantId: null, name: 'Robe', price: new Decimal(100), discount: new Decimal(0), taxRate: new Decimal(20), quantity, serialNumber: null, modifiers: null, weight: null }],
    payments: [
      opts.payment === 'cash'
        ? { code: 'CASH', label: 'Espèces', kind: 'CASH', amount: new Decimal(100 * quantity), reference: null }
        : { code: 'CARD', label: 'Carte', kind: 'CARD', amount: new Decimal(100 * quantity), reference: 'pi_1' },
    ],
  }
  const view = () => ({ ...sale, refunds: refunds.map((r) => ({ ...r })) })

  // Verrou consultatif simulé : les transactions se suivent une par une
  let chain: Promise<unknown> = Promise.resolve()
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    order: {
      findFirst: vi.fn(async () => view()),
      findUnique: vi.fn(async ({ where }: { where: { clientId: string } }) => refunds.find((r) => r.clientId === where.clientId) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (opts.createFails) throw new Error('base indisponible')
        const refund = {
          id: `r${refunds.length + 1}`,
          siteId: data.siteId,
          kind: 'REFUND',
          refundOfId: data.refundOfId,
          clientId: data.clientId,
          note: data.note,
          total: data.total,
          items: data.items.create.map((i: Record<string, unknown>) => ({ ...i })),
          payments: data.payments.create,
          receiptChain: { counter: refunds.length + 1, signedAt: new Date() },
        }
        refunds.push(refund)
        return refund
      }),
    },
    storeCredit: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
  }
  const prisma = {
    order: { findFirst: vi.fn(async () => ({ id: sale.id })) },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { organizationId_pinLookup: { pinLookup: string } } }) => {
        const found = Object.values(users).find((u) => pinLookup(SECRET, ORG, u.pin) === where.organizationId_pinLookup.pinLookup)
        return found ? { id: found.id, firstName: found.firstName, lastName: found.lastName, role: found.role } : null
      }),
    },
    $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => {
      const run = chain.then(() => fn(tx))
      chain = run.catch(() => undefined)
      return run
    }),
  }
  const payments = {
    refundByReference: vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
      if (opts.providerFails) throw new BadRequestException('Stripe indisponible')
      return { refundRef: 're_1' }
    }),
  }
  const audit = { log: vi.fn(async () => undefined) }
  const events = { emit: vi.fn() }
  const compliance = { signReceipt: vi.fn(async () => ({ id: 'rc1' })) }
  const customers = { reverseForRefund: vi.fn(async () => undefined) }
  const config = { get: (k: string) => (k === 'PIN_SECRET' ? SECRET : undefined), getOrThrow: () => SECRET }
  const authorization = new ManagerAuthorization(prisma as never, config as never, audit as never)
  const service = new RefundsService(prisma as never, compliance as never, payments as never, events as never, audit as never, customers as never, authorization)
  return { service, prisma, tx, payments, audit, events, refunds }
}

const dto = (extra: Record<string, unknown> = {}) => ({ lines: [{ orderItemId: 'i1', quantity: 1 }], refundTo: 'ORIGINAL' as const, restock: false, ...extra })
const as = (u: keyof typeof users, role = users[u].role) => ({ id: users[u].id, organizationId: ORG, email: `${u}@boutique.test`, role })

describe('remboursement : qui peut rembourser', () => {
  it('un propriétaire rembourse seul, sans code', async () => {
    const { service, payments, prisma } = setup()
    const r = await service.refund('site1', 'sale1', dto(), as('owner'))
    expect(r.kind).toBe('REFUND')
    expect(payments.refundByReference).toHaveBeenCalledWith(ORG, 'pi_1', 10_000)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('un responsable rembourse seul, sans code', async () => {
    const { service, audit } = setup()
    await service.refund('site1', 'sale1', dto(), as('manager'))
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.created', userId: 'm1', detail: expect.stringContaining('responsable connecté') }))
  })

  it('un vendeur sans code est refusé (403) et rien n\'est remboursé', async () => {
    const { service, payments, refunds, audit } = setup()
    const err = await service.refund('site1', 'sale1', dto(), as('seller')).catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.message).toContain("autorisation d'un responsable")
    expect(payments.refundByReference).not.toHaveBeenCalled()
    expect(refunds).toHaveLength(0)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'manager.authorization_refused', userId: 's1' }))
  })

  it('un vendeur avec le code d\'un responsable rembourse, et le journal dit qui a autorisé', async () => {
    const { service, audit, refunds } = setup()
    await service.refund('site1', 'sale1', dto({ managerPin: users.manager.pin }), as('seller'))
    expect(refunds).toHaveLength(1)
    expect(refunds[0].note).toContain('Autorisé par Marie Durand')
    const log = (audit.log.mock.calls as unknown as Array<[{ action: string; detail: string; userId: string }]>).map((c) => c[0]).find((l) => l.action === 'refund.created')!
    expect(log.userId).toBe('s1')
    expect(log.detail).toContain('seller@boutique.test')
    expect(log.detail).toContain('autorisé par Marie Durand (MANAGER, m1)')
  })

  it('le code d\'un propriétaire autorise aussi', async () => {
    const { service, refunds } = setup()
    await service.refund('site1', 'sale1', dto({ managerPin: users.owner.pin }), as('seller'))
    expect(refunds).toHaveLength(1)
  })

  it('un mauvais code est refusé (403)', async () => {
    const { service, payments } = setup()
    const err = await service.refund('site1', 'sale1', dto({ managerPin: '9999' }), as('seller')).catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.message).toContain('incorrect')
    expect(payments.refundByReference).not.toHaveBeenCalled()
  })

  it('le code d\'un autre vendeur, ou le sien, n\'autorise rien', async () => {
    const { service, refunds } = setup()
    await expect(service.refund('site1', 'sale1', dto({ managerPin: users.seller2.pin }), as('seller'))).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.refund('site1', 'sale1', dto({ managerPin: users.seller.pin }), as('seller'))).rejects.toBeInstanceOf(ForbiddenException)
    expect(refunds).toHaveLength(0)
  })

  it('un format de code invalide est refusé sans interroger la base', async () => {
    const { service, prisma } = setup()
    await expect(service.refund('site1', 'sale1', dto({ managerPin: 'abcd' }), as('seller'))).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('après 5 mauvais codes, même le bon code est bloqué', async () => {
    const { service, refunds } = setup()
    for (let i = 0; i < 5; i++) await service.refund('site1', 'sale1', dto({ managerPin: '9999' }), as('seller')).catch(() => undefined)
    const err = await service.refund('site1', 'sale1', dto({ managerPin: users.manager.pin }), as('seller')).catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.message).toContain("Trop d'essais")
    expect(refunds).toHaveLength(0)
  })
})

describe('remboursement : jamais deux fois', () => {
  it('double clic simultané sans identifiant : un seul remboursement carte, le second est refusé', async () => {
    const { service, payments, refunds } = setup({ quantity: 1 })
    const results = await Promise.allSettled([
      service.refund('site1', 'sale1', dto(), as('manager')),
      service.refund('site1', 'sale1', dto(), as('manager')),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failed.reason).toBeInstanceOf(BadRequestException)
    expect(failed.reason.message).toContain('déjà entièrement remboursé')
    expect(payments.refundByReference).toHaveBeenCalledTimes(1)
    expect(refunds).toHaveLength(1)
  })

  it('double clic simultané avec le même identifiant : le second reçoit le même retour', async () => {
    const { service, payments, refunds, events } = setup({ quantity: 1 })
    const [a, b] = await Promise.all([
      service.refund('site1', 'sale1', dto({ clientId: 'abc' }), as('manager')),
      service.refund('site1', 'sale1', dto({ clientId: 'abc' }), as('manager')),
    ])
    expect(a.id).toBe(b.id)
    expect(payments.refundByReference).toHaveBeenCalledTimes(1)
    expect(refunds).toHaveLength(1)
    expect(events.emit).toHaveBeenCalledTimes(1)
  })

  it('le prestataire est appelé sous le verrou de la vente, après lui', async () => {
    const { service, tx, payments } = setup()
    const order: string[] = []
    tx.$executeRaw.mockImplementation(async () => (order.push('verrou'), 1))
    payments.refundByReference.mockImplementation(async () => (order.push('prestataire'), { refundRef: 're_1' }))
    await service.refund('site1', 'sale1', dto(), as('manager'))
    expect(order).toEqual(['verrou', 'prestataire'])
  })

  it('refuse de dépasser la quantité vendue, ligne par ligne', async () => {
    const { service, payments } = setup({ quantity: 2 })
    await service.refund('site1', 'sale1', dto(), as('manager'))
    const err = await service.refund('site1', 'sale1', dto({ lines: [{ orderItemId: 'i1', quantity: 2 }] }), as('manager')).catch((e) => e)
    expect(err).toBeInstanceOf(BadRequestException)
    expect(err.message).toContain('1 au plus')
    expect(payments.refundByReference).toHaveBeenCalledTimes(1)
  })

  it('rembourse le total exact, jamais plus que la vente', async () => {
    const { service, refunds } = setup({ quantity: 2 })
    await service.refund('site1', 'sale1', dto(), as('manager'))
    await service.refund('site1', 'sale1', dto(), as('manager'))
    expect(refunds.reduce((a, r) => a + Number(r.total), 0)).toBe(-200)
    await expect(service.refund('site1', 'sale1', dto(), as('manager'))).rejects.toThrow('déjà entièrement remboursé')
  })

  it('le prestataire refuse : rien n\'est enregistré, message clair, la vente reste remboursable', async () => {
    const { service, refunds, events } = setup({ providerFails: true })
    const err = await service.refund('site1', 'sale1', dto(), as('manager')).catch((e) => e)
    expect(err).toBeInstanceOf(BadRequestException)
    expect(err.message).toContain("n'a pas confirmé le remboursement")
    expect(err.message).toContain('Rien n\'est enregistré')
    expect(refunds).toHaveLength(0)
    expect(events.emit).not.toHaveBeenCalled()
  })

  it('carte remboursée mais enregistrement impossible : référence donnée et audit', async () => {
    const { service, audit } = setup({ createFails: true })
    const err = await service.refund('site1', 'sale1', dto(), as('manager')).catch((e) => e)
    expect(err).toBeInstanceOf(InternalServerErrorException)
    expect(err.message).toContain('re_1')
    expect(err.message).toContain('Ne recommencez pas')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.provider_unrecorded', target: 'sale1' }))
  })

  it('un remboursement en espèces ne passe pas par le prestataire', async () => {
    const { service, payments } = setup({ payment: 'cash' })
    await service.refund('site1', 'sale1', dto({ refundTo: 'CASH' }), as('manager'))
    expect(payments.refundByReference).not.toHaveBeenCalled()
  })
})
