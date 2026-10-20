import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { ConflictException, ForbiddenException } from '@nestjs/common'
import { Role } from '@erp/types'
import { CANCEL_UNCONFIRMED, PaymentsService } from './payments.service'
import { TerminalPaymentsController } from './payments.controller'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const base = (extra: Row = {}): Row => ({
  id: 'pay1', siteId: 'site1', deviceId: 'dev1', provider: 'STRIPE', amount: 5000, status: 'PENDING', failureReason: null,
  providerRef: 'pi_1', createdAt: new Date(), checkoutUrl: null, expiresAt: null, currency: 'EUR', clientSaleId: null,
  device: { id: 'dev1', externalId: 'tmr_1' }, ...extra,
})

function setup(opts: { payment?: Row; remote?: string; cancelFails?: boolean; accounts?: Array<{ provider: string; testMode: boolean }>; realSale?: boolean } = {}) {
  let row = opts.payment ?? base()
  const prisma = {
    terminalPayment: {
      findFirst: vi.fn(async () => row),
      findUniqueOrThrow: vi.fn(async () => row),
      updateMany: vi.fn(async ({ data }: { data: Row }) => {
        if (row.status === 'PENDING') row = { ...row, ...data }
        return { count: 1 }
      }),
    },
    paymentDevice: { findUniqueOrThrow: vi.fn(async () => ({ id: 'dev1', externalId: 'tmr_1' })) },
    site: { findUniqueOrThrow: vi.fn(async () => ({ organizationId: 'org1' })) },
    paymentAccount: { findMany: vi.fn(async () => opts.accounts ?? []) },
    order: { findFirst: vi.fn(async () => (opts.realSale ? { id: 'o1' } : null)) },
  }
  const connector = {
    cancel: vi.fn(async () => {
      if (opts.cancelFails) throw new Error('lecteur hors ligne')
    }),
    status: vi.fn(async () => ({ status: opts.remote ?? 'PENDING' })),
  }
  const audit = { log: vi.fn(async () => undefined) }
  const service = new PaymentsService(prisma as never, { get: () => undefined } as never, audit as never)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internals = service as any
  internals.connector = () => connector
  internals.context = async () => ({ credentials: {}, http: vi.fn() })
  return { service, prisma, connector, audit, current: () => row }
}

describe('annulation d\'un paiement TPE', () => {
  it('confirmée par le prestataire : le paiement passe à annulé', async () => {
    const { service, connector, current } = setup()
    const v = await service.cancel('site1', 'pay1')
    expect(connector.cancel).toHaveBeenCalled()
    expect(v.status).toBe('CANCELED')
    expect(current().status).toBe('CANCELED')
  })

  it('non confirmée : erreur claire et le paiement reste en attente', async () => {
    const { service, current } = setup({ cancelFails: true })
    const err = await service.cancel('site1', 'pay1').catch((e) => e)
    expect(err).toBeInstanceOf(ConflictException)
    expect(err.message).toBe(CANCEL_UNCONFIRMED)
    expect(err.message).toBe("L'annulation n'a pas été confirmée par le terminal : vérifiez sur le TPE")
    expect(err.getResponse()).toMatchObject({ code: 'CANCEL_UNCONFIRMED', payment: { status: 'PENDING' } })
    expect(current().status).toBe('PENDING')
  })

  it('annulation en échec mais le client a payé : le paiement est reconnu accepté', async () => {
    const { service, current } = setup({ cancelFails: true, remote: 'SUCCEEDED' })
    const v = await service.cancel('site1', 'pay1')
    expect(v.status).toBe('SUCCEEDED')
    expect(current().status).toBe('SUCCEEDED')
  })

  it('paiement sans référence prestataire (jamais parti au TPE) : annulé directement', async () => {
    const { service, connector } = setup({ payment: base({ providerRef: null }) })
    expect((await service.cancel('site1', 'pay1')).status).toBe('CANCELED')
    expect(connector.cancel).not.toHaveBeenCalled()
  })

  it('délai dépassé et annulation impossible : le paiement n\'est pas déclaré échoué', async () => {
    const { service, current } = setup({ cancelFails: true, payment: base({ createdAt: new Date(Date.now() - 10 * 60_000) }) })
    const v = await service.get('site1', 'pay1')
    expect(v.status).toBe('PENDING')
    expect(current().status).toBe('PENDING')
  })
})

describe('simulation de paiement', () => {
  const manager = { id: 'm1', organizationId: 'org1', role: 'MANAGER' }
  const sim = () => base({ provider: 'SIMULATOR', providerRef: 'simpay_1' })

  it('refusée à un vendeur et journalisée', async () => {
    const { service, audit, current } = setup({ payment: sim() })
    const err = await service.simulate('site1', 'pay1', true, { id: 's1', organizationId: 'org1', role: 'SELLER' }).catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(current().status).toBe('PENDING')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment.simulate_refused', userId: 's1' }))
  })

  it('la route est réservée aux propriétaires et responsables', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TerminalPaymentsController.prototype.simulate)
    expect(roles).toEqual([Role.OWNER, Role.MANAGER])
    const guard = new RolesGuard({ getAllAndOverride: () => roles } as never)
    const ctx = (role: string) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) }) as never
    expect(guard.canActivate(ctx('SELLER'))).toBe(false)
    expect(guard.canActivate(ctx('MANAGER'))).toBe(true)
    expect(guard.canActivate(ctx('OWNER'))).toBe(true)
  })

  it('un responsable peut jouer le TPE virtuel d\'une démonstration, et c\'est journalisé', async () => {
    const { service, audit } = setup({ payment: sim() })
    expect((await service.simulate('site1', 'pay1', true, manager)).status).toBe('SUCCEEDED')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment.simulated', userId: 'm1', target: 'pay1' }))
  })

  it('refusée si l\'organisation a déjà encaissé des ventes réelles par carte', async () => {
    const { service, current } = setup({ payment: sim(), realSale: true })
    const err = await service.simulate('site1', 'pay1', true, manager).catch((e) => e)
    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err.message).toContain('ventes réelles')
    expect(current().status).toBe('PENDING')
  })

  it('refusée si un compte de paiement réel (hors test) est relié', async () => {
    const { service } = setup({ payment: sim(), accounts: [{ provider: 'STRIPE', testMode: false }] })
    await expect(service.simulate('site1', 'pay1', true, manager)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('compte explicitement en mode test : permise malgré des ventes', async () => {
    const { service } = setup({ payment: sim(), realSale: true, accounts: [{ provider: 'STRIPE', testMode: true }] })
    expect((await service.simulate('site1', 'pay1', false, manager)).status).toBe('FAILED')
  })
})
