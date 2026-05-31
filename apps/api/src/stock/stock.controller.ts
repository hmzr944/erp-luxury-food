import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { StockService } from './stock.service'

@Controller('sites/:siteId/stock')
@UseGuards(JwtAuthGuard, SiteGuard)
export class StockController {
  constructor(private stock: StockService) {}

  @Get('inventory')
  getInventory(@Param('siteId') siteId: string) {
    return this.stock.getInventory(siteId)
  }

  @Get('alerts')
  getAlerts(@Param('siteId') siteId: string) {
    return this.stock.getLowStockAlerts(siteId)
  }

  @Get('movements')
  getMovements(
    @Param('siteId') siteId: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stock.getMovements(siteId, productId, limit ? parseInt(limit) : 50)
  }

  @Post('movements')
  addMovement(
    @Param('siteId') siteId: string,
    @Body() dto: { productId: string; type: string; quantity: number; reason?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.stock.addMovement({ ...dto, siteId, userId: user.id })
  }
}
