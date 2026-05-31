import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { PrismaService } from '../common/prisma/prisma.service'
import { WebhooksService, type WebhookDelivery } from './webhooks.service'

@Processor('webhooks')
export class WebhooksProcessor {
  private readonly logger = new Logger(WebhooksProcessor.name)

  constructor(private prisma: PrismaService) {}

  @Process('deliver')
  async deliver(job: Job<WebhookDelivery>) {
    const { webhookId, url, secret, event, payload } = job.data
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
    const signature = WebhooksService.sign(secret, body)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ERP-Event': event,
          'X-ERP-Signature': signature,
          'User-Agent': 'ERP-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { lastTriggeredAt: new Date(), failureCount: 0 },
      })

      this.logger.debug(`Webhook ${webhookId} delivered: ${event}`)
    } catch (err) {
      this.logger.warn(`Webhook ${webhookId} failed: ${err}`)
      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { failureCount: { increment: 1 } },
      })
      throw err // Bull retry
    }
  }
}
