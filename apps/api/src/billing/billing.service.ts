import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PLAN_OFFERS, type PlanCode } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'
import { mapStripeStatus, stripeCall, StripeBillingError, verifyStripeSignature } from './stripe-billing'

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> & { id: string; metadata?: Record<string, string> } }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get secretKey() {
    return this.config.get<string>('STRIPE_BILLING_SECRET_KEY')
  }
  private price(plan: PlanCode) {
    return this.config.get<string>(plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_STARTER')
  }
  private get appUrl() {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  }

  async status(organizationId: string, role?: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        plan: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true,
        _count: { select: { sites: true } },
      },
    })
    const daysLeft = org.trialEndsAt ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86_400_000)) : null
    const offer = PLAN_OFFERS.find((p) => p.code === org.plan) ?? PLAN_OFFERS[0]
    return {
      plan: offer.code,
      planName: offer.name,
      status: org.subscriptionStatus,
      trialEndsAt: org.trialEndsAt,
      trialDaysLeft: org.subscriptionStatus === 'TRIALING' ? daysLeft : null,
      currentPeriodEnd: org.currentPeriodEnd,
      sites: org._count.sites,
      monthlyEstimate: offer.monthlyPrice * Math.max(1, org._count.sites),
      // Sans clés Stripe (démo, auto-hébergement) : l'essai continue, rien n'est facturé
      onlinePayment: !!this.secretKey && !!this.price('STARTER'),
      hasPaymentMethod: !!org.stripeCustomerId,
      // Souscrire et résilier : réservé au titulaire du compte
      canManage: role === 'OWNER',
    }
  }

  async checkout(organizationId: string, email: string, plan: PlanCode) {
    const key = this.secretKey
    const price = this.price(plan)
    if (!key || !price) throw new ServiceUnavailableException("Le paiement en ligne n'est pas encore activé sur ce serveur")
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { stripeCustomerId: true, _count: { select: { sites: true } } },
    })
    const session = await stripeCall<{ url: string }>(key, '/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': Math.max(1, org._count.sites),
      ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : { customer_email: email }),
      client_reference_id: organizationId,
      'metadata[organizationId]': organizationId,
      'metadata[plan]': plan,
      'subscription_data[metadata][organizationId]': organizationId,
      'subscription_data[metadata][plan]': plan,
      success_url: `${this.appUrl}/settings/billing?souscrit=1`,
      cancel_url: `${this.appUrl}/settings/billing`,
    }).catch(this.toHttp)
    return { url: session.url }
  }

  async portal(organizationId: string) {
    const key = this.secretKey
    if (!key) throw new ServiceUnavailableException("Le paiement en ligne n'est pas encore activé sur ce serveur")
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { stripeCustomerId: true } })
    if (!org.stripeCustomerId) throw new BadRequestException("Aucun abonnement à gérer pour l'instant")
    const session = await stripeCall<{ url: string }>(key, '/billing_portal/sessions', {
      customer: org.stripeCustomerId,
      return_url: `${this.appUrl}/settings/billing`,
    }).catch(this.toHttp)
    return { url: session.url }
  }

  async webhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_BILLING_WEBHOOK_SECRET')
    if (!secret || !rawBody || !verifyStripeSignature(rawBody, signature, secret)) throw new UnauthorizedException('Signature invalide')
    const event = JSON.parse(rawBody.toString('utf8')) as StripeEvent
    const o = event.data.object

    if (event.type === 'checkout.session.completed') {
      const orgId = o.metadata?.organizationId ?? (o.client_reference_id as string | undefined)
      if (!orgId) return { received: true }
      await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeCustomerId: o.customer as string,
          stripeSubscriptionId: o.subscription as string,
          plan: o.metadata?.plan === 'PRO' ? 'PRO' : 'STARTER',
          subscriptionStatus: 'ACTIVE',
        },
      })
    } else if (event.type.startsWith('customer.subscription.')) {
      const orgId = o.metadata?.organizationId
      const org = await this.prisma.organization.findFirst({
        where: { OR: [{ stripeSubscriptionId: o.id }, ...(orgId ? [{ id: orgId }] : [])] },
        select: { id: true },
      })
      if (!org) return { received: true }
      const items = o.items as { data?: Array<{ current_period_end?: number }> } | undefined
      const periodEnd = (o.current_period_end as number | undefined) ?? items?.data?.[0]?.current_period_end
      await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeSubscriptionId: o.id,
          stripeCustomerId: o.customer as string,
          subscriptionStatus: event.type === 'customer.subscription.deleted' ? 'CANCELED' : mapStripeStatus(o.status as string),
          ...(o.metadata?.plan ? { plan: o.metadata.plan === 'PRO' ? 'PRO' : 'STARTER' } : {}),
          ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
        },
      })
    }
    this.logger.log(`Stripe ${event.type} (${event.id})`)
    return { received: true }
  }

  private toHttp = (e: unknown): never => {
    if (e instanceof StripeBillingError) throw new BadRequestException(e.message)
    throw e
  }
}
