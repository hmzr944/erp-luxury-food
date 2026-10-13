import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { StockService } from './stock.service'
import { ArrayMaxSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator'

class ReceiveLotDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsOptional()
  @IsString()
  lotNumber?: string

  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  serialNumbers?: string[]
}

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

  @Get('lots')
  getLots(
    @Param('siteId') siteId: string,
    @Query('productId') productId?: string,
    @Query('expiringWithinDays') expiringWithinDays?: string,
  ) {
    return this.stock.getLots(siteId, {
      productId,
      expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays) : undefined,
    })
  }

  @Post('lots')
  receiveLot(
    @Param('siteId') siteId: string,
    @Body() dto: ReceiveLotDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.stock.receiveLot({
      ...dto,
      siteId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      userId: user.id,
    })
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
