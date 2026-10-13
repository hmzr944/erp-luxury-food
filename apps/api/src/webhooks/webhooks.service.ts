import { assertPublicUrl, UnsafeUrlError } from '../common/net/public-url'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { OnEvent } from '@nestjs/event-emitter'
import type { Queue } from 'bull'
import { createHmac, randomBytes } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'

export interface WebhookDelivery {
  webhookId: string
  url: string
  secret: string
  event: string
  payload: unknown
}

const ALL_EVENTS = [
  'order.created', 'order.updated', 'order.completed',
  'order.cancelled', 'stock.low', 'day.closed',
]

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhooks') private webhooksQueue: Queue,
  ) {}

  findByOrganization(organizationId: string) {
    return this.prisma.webhook.findMany({
      where: { organizationId },
      select: {
        id: true, url: true, events: true, isActive: true,
        failureCount: true, lastTriggeredAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(organizationId: string, data: { url: string; events: string[] }) {
    await this.publicUrl(data.url)
    const secret = `whsec_${randomBytes(20).toString('hex')}`
    return this.prisma.webhook.create({
      data: {
        organizationId,
        url: data.url,
        events: data.events.filter((e) => ALL_EVENTS.includes(e)),
        secret,
        isActive: true,
      },
      select: {
        id: true, url: true, events: true, isActive: true,
        secret: true, createdAt: true, // secret affiché UNE SEULE FOIS
      },
    })
  }

  async update(id: string, organizationId: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, organizationId } })
    if (!wh) throw new NotFoundException('Webhook introuvable')
    if (data.url) await this.publicUrl(data.url)
    // Seuls ces trois champs sont modifiables (jamais l'organisation)
    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...(data.url ? { url: data.url } : {}),
        ...(data.events ? { events: data.events.filter((e) => ALL_EVENTS.includes(e)) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: { id: true, url: true, events: true, isActive: true, failureCount: true, lastTriggeredAt: true, createdAt: true },
    })
  }

  private async publicUrl(url: string) {
    try {
      await assertPublicUrl(url)
    } catch (e) {
      if (e instanceof UnsafeUrlError) throw new BadRequestException(e.message)
      throw e
    }
  }

  async remove(id: string, organizationId: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, organizationId } })
    if (!wh) throw new NotFoundException('Webhook introuvable')
    await this.prisma.webhook.delete({ where: { id } })
    return { success: true }
  }

  async testWebhook(id: string, organizationId: string) {
    const wh = await this.prisma.webhook.findFirst({ where: { id, organizationId } })
    if (!wh) throw new NotFoundException('Webhook introuvable')
    await this.queueDelivery(wh, 'test', { message: 'Test webhook ERP', timestamp: new Date() })
    return { queued: true }
  }

  getEvents() { return ALL_EVENTS }

  // Dispatch un événement vers tous les webhooks concernés
  async dispatch(organizationId: string, event: string, payload: unknown): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { organizationId, isActive: true, events: { has: event } },
    })
    await Promise.all(webhooks.map((wh) => this.queueDelivery(wh, event, payload)))
  }

  private async queueDelivery(wh: any, event: string, payload: unknown) {
    await this.webhooksQueue.add(
      'deliver',
      { webhookId: wh.id, url: wh.url, secret: wh.secret, event, payload },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    )
  }

  // Signe la payload avec HMAC-SHA256
  static sign(secret: string, payload: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`
  }

  // Abonnement aux events NestJS
  @OnEvent('order.created')
  async onOrderCreated(payload: { siteId: string; order: any }) {
    const site = await this.prisma.site.findUnique({
      where: { id: payload.siteId },
      select: { organizationId: true },
    })
    if (site) await this.dispatch(site.organizationId, 'order.created', payload.order)
  }

  @OnEvent('order.updated')
  async onOrderUpdated(payload: { siteId: string; order: any }) {
    const site = await this.prisma.site.findUnique({
      where: { id: payload.siteId },
      select: { organizationId: true },
    })
    if (site) await this.dispatch(site.organizationId, 'order.updated', payload.order)
  }
}
