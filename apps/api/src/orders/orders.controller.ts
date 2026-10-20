import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { OrgScopedSite } from '../common/decorators/org-scoped-site.decorator'
import { OrdersService } from './orders.service'
import { CheckoutDto } from './dto/checkout.dto'
import { SyncSaleDto } from './dto/sync-sale.dto'
import { PrismaService } from '../common/prisma/prisma.service'
import { IsIn } from 'class-validator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RefundsService } from './refunds.service'
import { RefundDto } from './dto/refund.dto'

type AuthUser = { id: string; email?: string; organizationId: string }

// Retours et annulations passent par le remboursement signé, pas par le statut
class UpdateStatusDto {
  @IsIn(['PENDING', 'PREPARING', 'READY', 'COMPLETED'])
  status!: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED'
}

// Route publique pour la page click & collect client
@Controller('pickup')
export class PickupController {
  constructor(private prisma: PrismaService) {}

  @Get(':code')
  async getByPickupCode(@Param('code') code: string) {
    const order = await this.prisma.order.findUnique({
      where: { pickupCode: code.toUpperCase() },
      select: {
        id: true,
        status: true,
        total: true,
        channel: true,
        createdAt: true,
        items: { select: { name: true, quantity: true, price: true } },
        site: { select: { name: true } },
      },
    })
    if (!order) throw new NotFoundException('Commande introuvable')
    return order
  }
}

@Controller('sites/:siteId/orders')
@UseGuards(JwtAuthGuard, SiteGuard)
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private refunds: RefundsService,
  ) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(@Param('siteId') siteId: string, @Body() dto: CheckoutDto) {
    return this.orders.checkout(siteId, dto)
  }

  // Vente signée par une caisse ; idempotent sur clientId. Accessible à un
  // vendeur retiré du site depuis : la vente existe déjà, la refuser bloquerait
  // la chaîne de la caisse
  @Post('sync')
  @OrgScopedSite()
  @HttpCode(HttpStatus.OK)
  sync(@Param('siteId') siteId: string, @Body() dto: SyncSaleDto) {
    return this.orders.syncSignedSale(siteId, dto)
  }

  @Get()
  findAll(
    @Param('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('before') before?: string,
  ) {
    return this.orders.findBySite(siteId, {
      limit: limit ? parseInt(limit) : undefined,
      status,
      q,
      kind: kind === 'SALE' || kind === 'REFUND' ? kind : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      before: before || undefined,
    })
  }

  // Retour : ticket négatif signé, carte remboursée sur le TPE connecté ou avoir
  @Post(':id/refund')
  @HttpCode(HttpStatus.CREATED)
  refund(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() user: AuthUser) {
    return this.refunds.refund(siteId, id, dto, user)
  }

  @Get(':id')
  findOne(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.orders.findById(id, siteId)
  }

  @Patch(':id/status')
  updateStatus(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orders.updateStatus(id, siteId, dto.status)
  }
}

@Controller('sites/:siteId/credits')
@UseGuards(JwtAuthGuard, SiteGuard)
export class CreditsController {
  constructor(private refunds: RefundsService) {}

  @Get(':code')
  balance(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.refunds.creditBalance(user.organizationId, code)
  }
}
