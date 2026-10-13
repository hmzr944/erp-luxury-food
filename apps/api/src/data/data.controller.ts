import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { DataService } from './data.service'

class ImportProductsDto {
  @IsString()
  @MaxLength(2_000_000)
  csv!: string

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean
}

function sendCsv(res: Response, name: string, csv: string) {
  const day = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${name}_${day}.csv"`)
  res.send(csv)
}

@Controller('sites/:siteId/data')
@UseGuards(JwtAuthGuard, SiteGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class SiteDataController {
  constructor(private data: DataService) {}

  @Get('sales.csv')
  async sales(@Param('siteId') siteId: string, @Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    sendCsv(res, 'ventes', await this.data.salesCsv(siteId, from, to))
  }

  @Get('payments.csv')
  async payments(@Param('siteId') siteId: string, @Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    sendCsv(res, 'paiements', await this.data.paymentsCsv(siteId, from, to))
  }

  @Get('products.csv')
  async products(@Param('siteId') siteId: string, @Res() res: Response) {
    sendCsv(res, 'catalogue', await this.data.productsCsv(siteId))
  }

  @Get('stock.csv')
  async stock(@Param('siteId') siteId: string, @Res() res: Response) {
    sendCsv(res, 'stock', await this.data.stockCsv(siteId))
  }

  @Post('import/products')
  @HttpCode(HttpStatus.OK)
  importProducts(@Param('siteId') siteId: string, @Body() dto: ImportProductsDto) {
    return this.data.importProducts(siteId, dto.csv, dto.dryRun ?? true)
  }
}

@Controller('organizations/me/data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class OrganizationDataController {
  constructor(private data: DataService) {}

  @Get('clients.csv')
  async clients(@CurrentUser() user: { organizationId: string }, @Res() res: Response) {
    sendCsv(res, 'clients', await this.data.clientsCsv(user.organizationId))
  }
}
