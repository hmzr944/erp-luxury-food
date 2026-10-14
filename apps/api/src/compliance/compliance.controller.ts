import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { FISCAL_SOFTWARE, Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ComplianceService } from './compliance.service'
import { ClosuresService } from './closures.service'
import { ArchivesService } from './archives.service'
import { FiscalEventsService } from './fiscal-events.service'
import { ReceiptOpsService } from './receipt-ops.service'
import { SigningKeyService } from './signing-key.service'
import { PrismaService } from '../common/prisma/prisma.service'

class PeriodLabelDto {
  @IsString()
  @Matches(/^\d{4}(-\d{2})?$/)
  label!: string
}

class TrainingDto {
  @IsBoolean()
  active!: boolean

  @IsOptional()
  @IsString()
  @MaxLength(64)
  terminalId?: string
}

class TrainingTicketDto {
  @IsNumber()
  total!: number

  @IsObject()
  content!: Record<string, unknown>

  @IsOptional()
  @IsString()
  @MaxLength(64)
  terminalId?: string
}

class DuplicateDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  terminalId?: string
}

type Me = { id: string; organizationId: string }

// Conformité fiscale (art. 286 I 3° bis CGI) : grand livre, clôtures,
// archives, journal des événements, duplicatas et mode formation
@Controller('sites/:siteId/compliance')
@UseGuards(JwtAuthGuard, SiteGuard)
export class ComplianceController {
  constructor(
    private prisma: PrismaService,
    private ledger: ComplianceService,
    private closures: ClosuresService,
    private archives: ArchivesService,
    private events: FiscalEventsService,
    private ops: ReceiptOpsService,
    private keys: SigningKeyService,
  ) {}

  // Vue d'ensemble : totaux perpétuels, tickets en attente de clôture,
  // dernières clôtures, logiciel
  @Get('summary')
  async summary(@Param('siteId') siteId: string) {
    const [perpetual, pending, lastDay, lastMonth, lastYear, archives] = await Promise.all([
      this.ledger.perpetualAt(this.prisma, siteId),
      this.closures.pending(siteId),
      this.closures.list(siteId, 'DAY', 1),
      this.closures.list(siteId, 'MONTH', 1),
      this.closures.list(siteId, 'YEAR', 1),
      this.prisma.fiscalArchive.count({ where: { siteId } }),
    ])
    return {
      software: FISCAL_SOFTWARE,
      lastCounter: perpetual.counter,
      perpetualTotal: perpetual.total.toFixed(2),
      perpetualAbsTotal: perpetual.abs.toFixed(2),
      pending,
      lastClosures: { DAY: lastDay[0] ?? null, MONTH: lastMonth[0] ?? null, YEAR: lastYear[0] ?? null },
      archives,
    }
  }

  @Get('closures')
  listClosures(@Param('siteId') siteId: string, @Query('period') period = 'DAY') {
    const p = ['DAY', 'MONTH', 'YEAR'].includes(period) ? (period as 'DAY' | 'MONTH' | 'YEAR') : 'DAY'
    return this.closures.list(siteId, p, 120)
  }

  @Get('closures/:id')
  getClosure(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.closures.get(siteId, id)
  }

  @Post('closures/day')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  closeDay(@Param('siteId') siteId: string, @CurrentUser() user: Me) {
    return this.closures.closeDay(siteId, user.id)
  }

  @Post('closures/month')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  closeMonth(@Param('siteId') siteId: string, @Body() dto: PeriodLabelDto, @CurrentUser() user: Me) {
    return this.closures.closeMonth(siteId, dto.label, user.id)
  }

  @Post('closures/year')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  closeYear(@Param('siteId') siteId: string, @Body() dto: PeriodLabelDto, @CurrentUser() user: Me) {
    return this.closures.closeYear(siteId, dto.label, user.id)
  }

  // Vérification complète : grand livre, clôtures et journal des événements
  @Get('verify')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async verify(@Param('siteId') siteId: string, @CurrentUser() user: Me, @Query('from') from?: string, @Query('to') to?: string) {
    const [chain, closures, journal] = await Promise.all([
      this.ledger.verifyChain(siteId, { from: from ? Number(from) : undefined, to: to ? Number(to) : undefined }),
      this.closures.verify(siteId),
      this.events.verify(user.organizationId),
    ])
    const valid = chain.valid && closures.valid && journal.valid
    await this.events.log({
      organizationId: user.organizationId,
      siteId,
      code: valid ? 'CHAIN_VERIFIED' : 'CHAIN_ERROR',
      userId: user.id,
      detail: { tickets: chain.checked, closures: closures.checked, events: journal.checked, errors: [...chain.errors, ...closures.errors, ...journal.errors].slice(0, 10) },
    })
    return { valid, chain, closures, journal }
  }

  @Get('events')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  listEvents(@Param('siteId') siteId: string, @CurrentUser() user: Me) {
    return this.events.list(this.prisma, { organizationId: user.organizationId, siteId }, 200)
  }

  @Get('archives')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  listArchives(@Param('siteId') siteId: string) {
    return this.archives.list(siteId)
  }

  @Get('archives/:id/download')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async downloadArchive(@Param('siteId') siteId: string, @Param('id') id: string, @CurrentUser() user: Me, @Res() res: Response) {
    const file = await this.archives.download(siteId, id, user.id)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.body)
  }

  // Clé publique de l'éditeur : vérifier une archive sans FLŌW
  @Get('public-key')
  publicKey() {
    return this.keys.publicKey()
  }

  // Export tableur des clôtures (contrôle fiscal, expert-comptable)
  @Get('export/closures')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async exportClosures(@Param('siteId') siteId: string, @Query('period') period = 'DAY', @Res() res: Response) {
    const p = ['DAY', 'MONTH', 'YEAR'].includes(period) ? (period as 'DAY' | 'MONTH' | 'YEAR') : 'DAY'
    const list = await this.closures.list(siteId, p, 5000)
    const money = (v: { toFixed(n: number): string }) => v.toFixed(2).replace('.', ',')
    const header = 'Période;N°;Premier ticket;Dernier ticket;Tickets;Ventes TTC;Retours TTC;Grand total période;Total HT;TVA;Total perpétuel;Cumul absolu;Clôturée le;Automatique;Empreinte\n'
    const rows = list
      .map((c) =>
        [
          c.label,
          c.seq,
          c.firstCounter ?? '',
          c.lastCounter ?? '',
          c.ticketCount,
          money(c.salesTotal),
          money(c.refundsTotal),
          money(c.periodTotal),
          money(c.totalHT),
          money(c.totalTax),
          money(c.perpetualTotal),
          money(c.perpetualAbsTotal),
          c.closedAt.toISOString(),
          c.auto ? 'oui' : 'non',
          c.hash,
        ].join(';'),
      )
      .join('\n')
    const today = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="clotures-${p.toLowerCase()}-${today}.csv"`)
    res.send('﻿' + header + rows)
  }

  // Mode formation : début et fin tracés ; seul un responsable l'active
  @Post('training')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  training(@Param('siteId') siteId: string, @Body() dto: TrainingDto, @CurrentUser() user: Me) {
    return this.ops.training(siteId, dto.active, user, dto.terminalId)
  }

  @Post('training-tickets')
  @HttpCode(HttpStatus.CREATED)
  trainingTicket(@Param('siteId') siteId: string, @Body() dto: TrainingTicketDto, @CurrentUser() user: Me) {
    return this.ops.trainingTicket(siteId, dto, user)
  }

  @Post('orders/:orderId/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@Param('siteId') siteId: string, @Param('orderId') orderId: string, @Body() dto: DuplicateDto, @CurrentUser() user: Me) {
    return this.ops.duplicate(siteId, orderId, user, dto.terminalId)
  }
}
