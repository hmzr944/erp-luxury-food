import { describe, expect, it, vi } from 'vitest'
import { BillingService } from './billing.service'
import { SITE_QUANTITY_PRORATION, type StripeApi } from './stripe-billing'

function setup(opts: { keys?: boolean; org?: Record<string, unknown> | null; stripeQty?: number; getFails?: boolean; postFails?: boolean } = {}) {
  const org = opts.org === undefined
    ? { subscriptionStatus: 'ACTIVE', stripeSubscriptionId: 'sub_1', _count: { sites: 2 } }
    : opts.org
  const state = { qty: opts.stripeQty ?? 1 }
  const get = vi.fn(async () => {
    if (opts.getFails) throw new Error('Stripe indisponible')
    return { items: { data: [{ id: 'si_1', quantity: state.qty }] } }
  })
  const post = vi.fn(async (_k: string, _p: string, params: Record<string, string | number | undefined>) => {
    if (opts.postFails) throw new Error('Stripe indisponible')
    state.qty = Number(params.quantity)
    return {}
  })
  const prisma = {
    organization: {
      findUnique: vi.fn(async () => org),
      findUniqueOrThrow: vi.fn(async () => ({ plan: 'STARTER', subscriptionStatus: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null, stripeCustomerId: 'cus_1', _count: org?._count })),
    },
  }
  const env: Record<string, string> = opts.keys === false ? {} : { STRIPE_BILLING_SECRET_KEY: 'sk_test', STRIPE_PRICE_STARTER: 'price_1' }
  const config = { get: (k: string) => env[k] }
  const service = new BillingService(prisma as never, config as never, { get, post } as unknown as StripeApi)
  return { service, get, post, org: org as { _count: { sites: number } }, state }
}

describe('quantité d\'abonnement selon les sites', () => {
  it('facture un nouveau site', async () => {
    const t = setup({ stripeQty: 1 })
    await t.service.syncSubscriptionQuantity('org1')
    expect(t.post).toHaveBeenCalledWith('sk_test', '/subscription_items/si_1', { quantity: 2, proration_behavior: SITE_QUANTITY_PRORATION })
  })
  it('retire un site supprimé', async () => {
    const t = setup({ stripeQty: 3 })
    await t.service.syncSubscriptionQuantity('org1')
    expect(t.state.qty).toBe(2)
  })
  it('ne fait rien sans clés Stripe ni sans abonnement', async () => {
    const a = setup({ keys: false })
    await a.service.syncSubscriptionQuantity('org1')
    expect(a.get).not.toHaveBeenCalled()
    const b = setup({ org: { subscriptionStatus: 'ACTIVE', stripeSubscriptionId: null, _count: { sites: 2 } } })
    await b.service.syncSubscriptionQuantity('org1')
    expect(b.get).not.toHaveBeenCalled()
    const c = setup({ org: { subscriptionStatus: 'CANCELED', stripeSubscriptionId: 'sub_1', _count: { sites: 2 } } })
    await c.service.syncSubscriptionQuantity('org1')
    expect(c.get).not.toHaveBeenCalled()
  })
  it('une erreur Stripe ne remonte jamais', async () => {
    await expect(setup({ getFails: true }).service.syncSubscriptionQuantity('org1')).resolves.toBeUndefined()
    await expect(setup({ postFails: true }).service.syncSubscriptionQuantity('org1')).resolves.toBeUndefined()
  })
  it('est idempotent', async () => {
    const t = setup({ stripeQty: 1 })
    await t.service.syncSubscriptionQuantity('org1')
    await t.service.syncSubscriptionQuantity('org1')
    expect(t.post).toHaveBeenCalledTimes(1)
  })
  it('rattrape à la lecture du statut, sans écriture inutile', async () => {
    const t = setup({ stripeQty: 1 })
    await t.service.status('org1', 'OWNER')
    expect(t.post).toHaveBeenCalledTimes(1)
    await t.service.status('org1', 'OWNER')
    expect(t.post).toHaveBeenCalledTimes(1)
  })
  it('garde au moins une unité facturée', async () => {
    const t = setup({ stripeQty: 2, org: { subscriptionStatus: 'TRIALING', stripeSubscriptionId: 'sub_1', _count: { sites: 0 } } })
    await t.service.syncSubscriptionQuantity('org1')
    expect(t.state.qty).toBe(1)
  })
})
