import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { CashCountError, closingPlan, countCash } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

const cents = (d: Decimal | number | null | undefined) => Math.round(Number(d ?? 0) * 100)
const euros = (c: number) => new Decimal(c).div(100)

// Fond de caisse, tiroir par tiroir (une caisse = un tiroir).
// Ouverture : on confirme le fond laissé la veille. Fermeture : comptage par
// coupures, l'écart n'est montré qu'après le comptage (comptage à l'aveugle),
// et un petit écart ne bloque jamais la fermeture.
@Injectable()
export class CashService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async current(siteId: string, terminalId: string) {
    await this.terminal(siteId, terminalId)
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { cashFloat: true, cashTolerance: true } })
    const open = await this.prisma.cashSession.findFirst({ where: { terminalId, status: 'OPEN' }, orderBy: { openedAt: 'desc' } })
    const last = await this.prisma.cashSession.findFirst({
      where: { terminalId, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      select: { keptFloat: true, closedAt: true },
    })
    return {
      session: open ? this.view(open) : null,
      // Fond annoncé par la dernière fermeture, sinon le fond habituel du site
      suggestedOpening: last?.keptFloat != null ? Number(last.keptFloat) : Number(site.cashFloat),
      lastClosedAt: last?.closedAt ?? null,
      floatTarget: Number(site.cashFloat),
      tolerance: Number(site.cashTolerance),
    }
  }

  async open(siteId: string, userId: string, dto: { terminalId: string; amount: number; note?: string }) {
    await this.terminal(siteId, dto.terminalId)
    const state = await this.current(siteId, dto.terminalId)
    if (state.session) throw new ConflictException('Cette caisse est déjà ouverte')
    const adjusted = Math.round(dto.amount * 100) !== Math.round(state.suggestedOpening * 100)
    const session = await this.prisma.cashSession.create({
      data: {
        siteId,
        terminalId: dto.terminalId,
        openedById: userId,
        expectedOpening: new Decimal(state.suggestedOpening),
        openingFloat: new Decimal(dto.amount),
        openingNote: dto.note?.trim() || (adjusted ? 'Fond ajusté à l’ouverture' : null),
      },
    })
    return this.view(session)
  }

  async close(siteId: string, userId: string, dto: { terminalId: string; denominations: Record<string, number>; reason?: string }) {
    await this.terminal(siteId, dto.terminalId)
    const session = await this.prisma.cashSession.findFirst({ where: { terminalId: dto.terminalId, status: 'OPEN' } })
    if (!session) throw new NotFoundException("Cette caisse n'est pas ouverte")
    let counted: number
    try {
      counted = countCash(dto.denominations)
    } catch (e) {
      if (e instanceof CashCountError) throw new BadRequestException(e.message)
      throw e
    }
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { cashFloat: true, cashTolerance: true } })
    const cashIn = await this.cashMovements(dto.terminalId, session.openedAt)
    const plan = closingPlan({
      counted,
      expected: cents(session.openingFloat) + cashIn,
      floatTarget: cents(site.cashFloat),
      tolerance: cents(site.cashTolerance),
    })
    const reason = dto.reason?.trim()
    if (!plan.withinTolerance && !reason) {
      // Rien n'est enregistré : l'écran demande le motif puis renvoie le comptage
      throw new UnprocessableEntityException({
        message: 'Écart au-delà de la tolérance : choisissez un motif',
        needsReason: true,
        difference: plan.difference / 100,
      })
    }
    const closed = await this.prisma.cashSession.update({
      where: { id: session.id, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
        denominations: dto.denominations,
        counted: euros(plan.counted),
        expectedCash: euros(plan.expected),
        difference: euros(plan.difference),
        differenceReason: reason || null,
        keptFloat: euros(plan.keep),
        deposit: euros(plan.deposit),
      },
    })
    const site2 = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    await this.audit.log({
      organizationId: site2.organizationId,
      userId,
      action: 'cash.closed',
      target: closed.id,
      terminalId: dto.terminalId,
      detail: `compté ${(plan.counted / 100).toFixed(2)} €, écart ${(plan.difference / 100).toFixed(2)} €${reason ? `, ${reason}` : ''}`,
    })
    return { ...this.view(closed), withinTolerance: plan.withinTolerance }
  }

  async updateSettings(siteId: string, dto: { cashFloat?: number; cashTolerance?: number }) {
    return this.prisma.site.update({
      where: { id: siteId },
      data: {
        ...(dto.cashFloat !== undefined ? { cashFloat: new Decimal(dto.cashFloat) } : {}),
        ...(dto.cashTolerance !== undefined ? { cashTolerance: new Decimal(dto.cashTolerance) } : {}),
      },
      select: { cashFloat: true, cashTolerance: true },
    })
  }

  async history(siteId: string) {
    const sessions = await this.prisma.cashSession.findMany({ where: { siteId }, orderBy: { openedAt: 'desc' }, take: 60 })
    return sessions.map((s) => this.view(s))
  }

  // Espèces encaissées (et rendues lors des retours) par cette caisse depuis l'ouverture
  private async cashMovements(terminalId: string, since: Date): Promise<number> {
    const payments = await this.prisma.orderPayment.findMany({
      where: {
        kind: 'CASH',
        order: { receiptChain: { terminalId }, OR: [{ soldAt: { gte: since } }, { soldAt: null, createdAt: { gte: since } }] },
      },
      select: { amount: true },
    })
    return payments.reduce((a, p) => a + cents(p.amount), 0)
  }

  private async terminal(siteId: string, terminalId: string) {
    const t = await this.prisma.terminal.findFirst({ where: { id: terminalId, siteId }, select: { id: true } })
    if (!t) throw new NotFoundException('Caisse inconnue sur ce site')
  }

  private view(s: {
    id: string; terminalId: string; status: string; openedAt: Date; openingFloat: Decimal; expectedOpening: Decimal | null; openingNote: string | null
    closedAt: Date | null; counted: Decimal | null; expectedCash: Decimal | null; difference: Decimal | null; differenceReason: string | null
    keptFloat: Decimal | null; deposit: Decimal | null; denominations?: unknown
  }) {
    const n = (d: Decimal | null) => (d == null ? null : Number(d))
    return {
      id: s.id,
      terminalId: s.terminalId,
      status: s.status,
      openedAt: s.openedAt,
      openingFloat: Number(s.openingFloat),
      expectedOpening: n(s.expectedOpening),
      openingNote: s.openingNote,
      closedAt: s.closedAt,
      counted: n(s.counted),
      expectedCash: n(s.expectedCash),
      difference: n(s.difference),
      differenceReason: s.differenceReason,
      keptFloat: n(s.keptFloat),
      deposit: n(s.deposit),
    }
  }
}
