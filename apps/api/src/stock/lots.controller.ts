import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { LotsService } from './lots.service'
import { isLotFilter } from './lots'

const DAY = /^\d{4}-\d{2}-\d{2}$/

class ReceiveDto {
  @IsString() productId!: string
  @IsOptional() @IsString() variantId?: string
  @IsOptional() @IsString() @MaxLength(60) lotNumber?: string
  @IsOptional() @Matches(DAY, { message: 'Date limite : AAAA-MM-JJ' }) expiresAt?: string
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1_000_000) quantity?: number
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) serialNumbers?: string[]
  @IsOptional() @Matches(DAY, { message: 'Date de réception : AAAA-MM-JJ' }) receivedAt?: string
}

class LossDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) @Max(1_000_000) quantity?: number
  @IsString() @MaxLength(200) reason!: string
}

// Lecture : tous les rôles du site. Réception et retrait : titulaire et gérant.
@Controller('sites/:siteId/lots')
@UseGuards(JwtAuthGuard, SiteGuard)
export class LotsController {
  constructor(private lots: LotsService) {}

  @Get()
  list(@Param('siteId') siteId: string, @Query('filtre') filtre?: string, @Query('productId') productId?: string) {
    return this.lots.list(siteId, isLotFilter(filtre) ? filtre : 'all', productId)
  }

  // Produits qui n'ont plus que des lots périmés (avertissement en caisse)
  @Get('perimes')
  expiredOnly(@Param('siteId') siteId: string) {
    return this.lots.expiredOnly(siteId)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  receive(@Param('siteId') siteId: string, @Body() dto: ReceiveDto, @CurrentUser() user: { id: string }) {
    return this.lots.receive(siteId, user.id, dto)
  }

  @Post(':lotId/perte')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  loss(@Param('siteId') siteId: string, @Param('lotId') lotId: string, @Body() dto: LossDto, @CurrentUser() user: { id: string }) {
    return this.lots.loss(siteId, user.id, lotId, dto)
  }
}
