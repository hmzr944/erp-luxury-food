import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { HttpException, type ExecutionContext } from '@nestjs/common'
import { SubscriptionGuard } from './subscription.guard'
import { ProductsController } from '../../products/products.controller'
import { SitesController } from '../../sites/sites.controller'
import { TerminalsController } from '../../terminals/terminals.controller'
import { UsersController } from '../../users/users.controller'
import { BillingController } from '../../billing/billing.controller'
import { OrdersController } from '../../orders/orders.controller'

const DAY = 86_400_000
const STRIPE = { STRIPE_BILLING_SECRET_KEY: 'sk_test', STRIPE_PRICE_STARTER: 'price_x' } as Record<string, string>

function guard(org: Record<string, unknown> | null, env = STRIPE) {
  const prisma = { organization: { findUnique: vi.fn(async () => org) } }
  const config = { get: (k: string) => env[k] }
  return { g: new SubscriptionGuard(prisma as never, config as never), prisma }
}
const ctx = (user?: { organizationId: string }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext

const ended = (days: number) => ({ subscriptionStatus: 'TRIALING', trialEndsAt: new Date(Date.now() - days * DAY), currentPeriodEnd: null })

describe('garde abonnement', () => {
  it('laisse passer essai, délai de grâce et abonnement actif', async () => {
    await expect(guard(ended(-3)).g.canActivate(ctx({ organizationId: 'o' }))).resolves.toBe(true)
    await expect(guard(ended(3)).g.canActivate(ctx({ organizationId: 'o' }))).resolves.toBe(true)
    await expect(guard({ ...ended(90), subscriptionStatus: 'ACTIVE' }).g.canActivate(ctx({ organizationId: 'o' }))).resolves.toBe(true)
  })

  it('refuse en 402 une fois le compte verrouillé', async () => {
    const err = await guard(ended(8)).g.canActivate(ctx({ organizationId: 'o' })).catch((e) => e)
    expect(err).toBeInstanceOf(HttpException)
    expect((err as HttpException).getStatus()).toBe(402)
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'SUBSCRIPTION_REQUIRED' })
  })

  it('ne verrouille pas sans paiement en ligne configuré', async () => {
    await expect(guard(ended(90), {}).g.canActivate(ctx({ organizationId: 'o' }))).resolves.toBe(true)
  })

  it("sans compte, laisse répondre l'authentification", async () => {
    const { g, prisma } = guard(ended(90))
    await expect(g.canActivate(ctx())).resolves.toBe(true)
    expect(prisma.organization.findUnique).not.toHaveBeenCalled()
  })
})

// Le garde n'est posé que sur des écritures non fiscales
const guarded = (cls: { prototype: object }, method: string) =>
  ((Reflect.getMetadata(GUARDS_METADATA, (cls.prototype as Record<string, unknown>)[method] as object) ?? []) as unknown[]).includes(SubscriptionGuard)

describe('routes gardées', () => {
  it('catalogue, boutiques, caisses et membres : création et modification', () => {
    for (const m of ['create', 'update', 'createModifierGroup', 'updateModifierGroup', 'createCategory', 'updateCategory']) expect(guarded(ProductsController, m)).toBe(true)
    expect(guarded(SitesController, 'create')).toBe(true)
    expect(guarded(TerminalsController, 'register')).toBe(true)
    expect(guarded(UsersController, 'create')).toBe(true)
  })

  it('jamais sur la facturation, les ventes, les lectures ni les retraits', () => {
    for (const m of ['status', 'checkout', 'portal', 'webhook']) expect(guarded(BillingController, m)).toBe(false)
    for (const m of Object.getOwnPropertyNames(OrdersController.prototype)) expect(guarded(OrdersController, m)).toBe(false)
    expect(guarded(ProductsController, 'findAll')).toBe(false)
    expect(guarded(ProductsController, 'remove')).toBe(false)
    expect(guarded(TerminalsController, 'deactivate')).toBe(false)
    expect(guarded(UsersController, 'remove')).toBe(false)
  })
})
