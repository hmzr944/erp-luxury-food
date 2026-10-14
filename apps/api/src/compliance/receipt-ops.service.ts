import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { FiscalEventsService } from './fiscal-events.service'

export interface TrainingTicketInput {
  terminalId?: string
  total: number
  content: Record<string, unknown>
}

// Duplicatas et mode formation : deux opérations qui ne touchent jamais le
// grand livre mais doivent rester traçables (BOI-TVA-DECLA-30-10-30 § 150)
@Injectable()
export class ReceiptOpsService {
  constructor(
    private prisma: PrismaService,
    private events: FiscalEventsService,
  ) {}

  // Réimpression d'un ticket : numéro de duplicata croissant, tracé au journal
  async duplicate(siteId: string, orderId: string, user: { id: string }, terminalId?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, siteId },
      select: { id: true, receiptChain: { select: { counter: true } }, site: { select: { organizationId: true } } },
    })
    if (!order) throw new NotFoundException('Ticket introuvable')
    if (!order.receiptChain) throw new BadRequestException('Cette commande n’a pas de ticket de caisse')

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'duplicate:' + orderId}))`
      const last = await tx.receiptDuplicate.findFirst({ where: { orderId }, orderBy: { number: 'desc' }, select: { number: true } })
      const number = (last?.number ?? 0) + 1
      const dup = await tx.receiptDuplicate.create({ data: { orderId, siteId, number, userId: user.id, terminalId: terminalId ?? null } })
      await this.events.record(tx, {
        organizationId: order.site.organizationId,
        siteId,
        code: 'DUPLICATE_PRINTED',
        userId: user.id,
        terminalId,
        detail: { orderId, counter: order.receiptChain!.counter, duplicate: number },
      })
      return { number: dup.number, createdAt: dup.createdAt }
    })
  }

  duplicates(orderId: string) {
    return this.prisma.receiptDuplicate.findMany({ where: { orderId }, orderBy: { number: 'asc' } })
  }

  // Début ou fin du mode formation sur une caisse
  async training(siteId: string, active: boolean, user: { id: string }, terminalId?: string) {
    const site = await this.site(siteId)
    await this.events.log({
      organizationId: site.organizationId,
      siteId,
      code: active ? 'TRAINING_STARTED' : 'TRAINING_STOPPED',
      userId: user.id,
      terminalId,
    })
    return { active }
  }

  // Ticket fictif : numéroté à part, opérateur identifié, hors grand livre
  async trainingTicket(siteId: string, input: TrainingTicketInput, user: { id: string }) {
    if (!Number.isFinite(input.total) || Math.abs(input.total) > 1_000_000) throw new BadRequestException('Montant invalide')
    const site = await this.site(siteId)
    const who = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, email: true } })
    const userName = [who?.firstName, who?.lastName].filter(Boolean).join(' ') || who?.email || user.id
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'training:' + siteId}))`
      const last = await tx.trainingTicket.findFirst({ where: { siteId }, orderBy: { number: 'desc' }, select: { number: true } })
      const number = (last?.number ?? 0) + 1
      const ticket = await tx.trainingTicket.create({
        data: {
          siteId,
          number,
          userId: user.id,
          userName,
          terminalId: input.terminalId ?? null,
          total: new Decimal(input.total).toDecimalPlaces(2),
          content: input.content as Prisma.InputJsonValue,
        },
      })
      await this.events.record(tx, {
        organizationId: site.organizationId,
        siteId,
        code: 'TRAINING_TICKET',
        userId: user.id,
        terminalId: input.terminalId,
        detail: { number, total: ticket.total.toFixed(2) },
      })
      return { number, userName, createdAt: ticket.createdAt }
    })
  }

  private async site(siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId }, select: { organizationId: true } })
    if (!site) throw new NotFoundException('Site introuvable')
    return site
  }
}
