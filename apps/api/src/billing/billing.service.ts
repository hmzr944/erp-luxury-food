import { BadRequestException, Inject, Injectable, Optional, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PLAN_OFFERS, type PlanCode } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'
import { defaultStripeApi, mapStripeStatus, SITE_QUANTITY_PRORATION, STRIPE_API, stripeCall, StripeBillingError, type StripeApi, verifyStripeSignature } from './stripe-billing'
import { accessState, billingEnabled } from './access-state'

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
    @Optional() @Inject(STRIPE_API) private stripe: StripeApi = defaultStripeApi,
  ) {}

  // Aligne la quantité de la ligne d'abonnement Stripe sur le nombre de sites.
  // Idempotent : aucune écriture si Stripe a déjà la bonne quantité. Ne lève jamais :
  // la gestion des sites et les ventes ne dépendent pas de Stripe (rattrapage à la lecture du statut).
  async syncSubscriptionQuantity(organizationId: string): Promise<void> {
    try {
      const key = this.secretKey
      if (!key || !billingEnabled(this.config)) return
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { subscriptionStatus: true, stripeSubscriptionId: true, _count: { select: { sites: true } } },
      })
      if (!org?.stripeSubscriptionId) return
      if (org.subscriptionStatus !== 'ACTIVE' && org.subscriptionStatus !== 'TRIALING') return
      const wanted = Math.max(1, org._count.sites)
      const sub = await this.stripe.get<{ items?: { data?: Array<{ id: string; quantity?: number }> } }>(
        key,
        `/subscriptions/${encodeURIComponent(org.stripeSubscriptionId)}`,
      )
      const item = sub.items?.data?.[0]
      if (!item || item.quantity === wanted) return
      await this.stripe.post(key, `/subscription_items/${encodeURIComponent(item.id)}`, {
        quantity: wanted,
        proration_behavior: SITE_QUANTITY_PRORATION,
      })
      this.logger.log(`Quantité d'abonnement mise à jour : ${wanted} (organisation ${organizationId})`)
    } catch (e) {
      this.logger.error(`Synchronisation de la quantité Stripe impossible (organisation ${organizationId}) : ${e instanceof Error ? e.message : e}`)
    }
  }

  private get secretKey() {
    return this.config.get<string>('STRIPE_BILLING_SECRET_KEY')
  }
  private price(plan: PlanCode) {
    return this.config.get<string>(plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_STARTER')
  }
  private get appUrl() {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  }

  async status(organizationId: string, role?: string, now = new Date()) {
    // Rattrapage si une synchronisation précédente a échoué (sans effet si Stripe est à jour)
    await this.syncSubscriptionQuantity(organizationId)
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        plan: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, stripeCustomerId: true,
        _count: { select: { sites: true } },
      },
    })
    const daysLeft = org.trialEndsAt ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000)) : null
    const onlinePayment = billingEnabled(this.config)
    const access = accessState(org, now, { billingEnabled: onlinePayment })
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
      onlinePayment,
      // Accès à la caisse : essai, abonné, délai de grâce ou verrouillé (nouvelles
      // ventes impossibles ; ventes en attente, clôtures et exports toujours permis)
      access: access.state,
      lockAt: access.lockAt,
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
