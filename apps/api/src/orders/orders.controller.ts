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
import { OrdersService } from './orders.service'
import { CheckoutDto } from './dto/checkout.dto'
import { PrismaService } from '../common/prisma/prisma.service'

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
      },
    })
    if (!order) throw new NotFoundException('Commande introuvable')
    return order
  }
}

@Controller('sites/:siteId/orders')
@UseGuards(JwtAuthGuard, SiteGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(@Param('siteId') siteId: string, @Body() dto: CheckoutDto) {
    return this.orders.checkout(siteId, dto)
  }

  @Get()
  findAll(
    @Param('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.orders.findBySite(siteId, {
      limit: limit ? parseInt(limit) : undefined,
      status,
    })
  }

  @Get(':id')
  findOne(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.orders.findById(id, siteId)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.orders.updateStatus(id, siteId, status)
  }
}
