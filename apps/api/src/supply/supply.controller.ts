import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { SupplyService } from './supply.service'
import { SupplyAlertDto, CatalogItemDto, ReceiveDto, SaveSupplyOrderDto, ShipDto, StartProductionDto, SupplySettingsDto } from './supply.dto'

type AuthUser = { id: string }

@Controller('sites/:siteId/supply')
@UseGuards(JwtAuthGuard, SiteGuard)
export class SupplyController {
  constructor(private supply: SupplyService) {}

  // Réglages du site : labo / dépôt, heure de clôture, délai
  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  settings(@Param('siteId') siteId: string, @Body() dto: SupplySettingsDto) {
    return this.supply.updateSettings(siteId, dto)
  }

  // --- Boutique ---
  @Get('suppliers')
  suppliers(@Param('siteId') siteId: string) {
    return this.supply.suppliers(siteId)
  }

  @Get('draft')
  draft(@Param('siteId') siteId: string, @Query('supplierId') supplierId: string, @Query('day') day?: string) {
    return this.supply.draft(siteId, supplierId, day)
  }

  @Put('orders')
  save(@Param('siteId') siteId: string, @Body() dto: SaveSupplyOrderDto, @CurrentUser() user: AuthUser) {
    return this.supply.save(siteId, user.id, dto)
  }

  @Get('orders')
  outgoing(@Param('siteId') siteId: string) {
    return this.supply.outgoing(siteId)
  }

  @Get('inbox')
  inbox(@Param('siteId') siteId: string) {
    return this.supply.inbox(siteId)
  }

  @Post('orders/:id/receive')
  receive(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: ReceiveDto, @CurrentUser() user: AuthUser) {
    return this.supply.receive(siteId, id, user.id, dto)
  }

  // --- Labo / dépôt ---
  @Get('production')
  production(@Param('siteId') siteId: string, @Query('day') day?: string) {
    return this.supply.production(siteId, day)
  }

  @Post('production/start')
  start(@Param('siteId') siteId: string, @Body() dto: StartProductionDto) {
    return this.supply.startProduction(siteId, dto.day)
  }

  @Post('orders/:id/ship')
  ship(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: ShipDto, @CurrentUser() user: AuthUser) {
    return this.supply.ship(siteId, id, user.id, dto)
  }

  @Get('catalog')
  catalog(@Param('siteId') siteId: string) {
    return this.supply.catalog(siteId)
  }

  @Patch('catalog/:productId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  updateCatalog(@Param('siteId') siteId: string, @Param('productId') productId: string, @Body() dto: CatalogItemDto) {
    return this.supply.updateCatalogItem(siteId, productId, dto)
  }

  @Get('statement')
  statement(@Param('siteId') siteId: string, @Query('month') month: string) {
    return this.supply.statement(siteId, month)
  }

  // --- Alertes du labo au réseau ---
  @Get('alerts')
  alerts(@Param('siteId') siteId: string) {
    return this.supply.alerts(siteId)
  }

  @Post('alerts')
  createAlert(@Param('siteId') siteId: string, @Body() dto: SupplyAlertDto, @CurrentUser() user: AuthUser) {
    return this.supply.createAlert(siteId, user.id, dto)
  }

  @Delete('alerts/:id')
  @HttpCode(HttpStatus.OK)
  deleteAlert(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.supply.deleteAlert(siteId, id)
  }
}
