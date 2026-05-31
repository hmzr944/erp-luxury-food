import {
  Controller, Get, Post, Body, Param, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ComplianceService } from './compliance.service'
import { Role } from '@erp/types'

@Controller('sites/:siteId/compliance')
@UseGuards(JwtAuthGuard, SiteGuard)
export class ComplianceController {
  constructor(private compliance: ComplianceService) {}

  @Post('close-day')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  closeDay(
    @Param('siteId') siteId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.compliance.closeDay(siteId, user.id)
  }

  @Get('closures')
  getClosures(@Param('siteId') siteId: string) {
    return this.compliance.getClosures(siteId)
  }

  // Export DGFiP — CSV des clôtures journalières
  @Get('export/dgfip')
  async exportDGFiP(
    @Param('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const closures = await this.compliance.getClosures(siteId, 365)
    const now = new Date().toISOString().split('T')[0]

    const header = 'Date;Ticket début;Ticket fin;Nb commandes;Total TTC;Hash\n'
    const rows = closures
      .map((c) => [
        new Date(c.date).toLocaleDateString('fr-FR'),
        '',
        c.lastCounter,
        c.totalOrders,
        Number(c.totalAmount).toFixed(2).replace('.', ','),
        c.hash,
      ].join(';'))
      .join('\n')

    const csv = '﻿' + header + rows // BOM UTF-8 pour Excel

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="NF525_export_${now}.csv"`)
    res.send(csv)
  }

  // Vérifie l'intégrité de la chaîne NF525 d'un jour donné
  @Get('verify/:date')
  async verifyChain(
    @Param('siteId') siteId: string,
    @Param('date') date: string,
  ) {
    return this.compliance.verifyDayChain(siteId, new Date(date))
  }
}
