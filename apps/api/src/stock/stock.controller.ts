import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { StockService } from './stock.service'
import { CORRECTION_REASON_CODES, MANUAL_MOVEMENT_TYPES, type CorrectionReason, type ManualMovementType } from './stock-rules'
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator'

export class MovementDto {
  @IsString()
  @MinLength(1)
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  // Réception ou perte ; la correction a sa propre route
  @IsIn(MANUAL_MOVEMENT_TYPES as unknown as string[], { message: 'Type de mouvement : RESTOCK (réception) ou LOSS (perte)' })
  type!: ManualMovementType

  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantité : 3 décimales au plus' })
  @Min(0.001, { message: 'La quantité doit être supérieure à zéro' })
  quantity!: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}

export class CorrectionDto {
  @IsString()
  @MinLength(1)
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  // Quantité réellement comptée : l'écart est calculé par le serveur
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantité : 3 décimales au plus' })
  @Min(0, { message: 'La quantité comptée ne peut pas être négative' })
  countedQuantity!: number

  @IsIn(CORRECTION_REASON_CODES, { message: 'Motif : casse, vol, erreur de saisie, don ou autre' })
  reasonCode!: CorrectionReason

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string
}

export class ItemSettingsDto {
  @IsOptional()
  @IsString()
  variantId?: string

  // null efface le seuil
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Seuil : 3 décimales au plus' })
  @Min(0, { message: 'Le seuil ne peut pas être négatif' })
  alertAt?: number | null

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit?: string
}

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
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
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

  // Entrée ou sortie à la main : titulaire et gérant seulement, un vendeur consulte
  @Post('movements')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  addMovement(
    @Param('siteId') siteId: string,
    @Body() dto: MovementDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.stock.addMovement({ ...dto, siteId, userId: user.id })
  }

  @Post('corrections')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  correct(
    @Param('siteId') siteId: string,
    @Body() dto: CorrectionDto,
    @CurrentUser() user: { id: string; organizationId: string },
  ) {
    return this.stock.correct({ ...dto, siteId, organizationId: user.organizationId, userId: user.id })
  }

  // Seuil d'alerte et unité d'un produit (ou d'une variante) du stock
  @Patch('items/:productId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  updateItem(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
    @Body() dto: ItemSettingsDto,
  ) {
    return this.stock.updateItemSettings(siteId, productId, dto)
  }
}
