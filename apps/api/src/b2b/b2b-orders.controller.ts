import { CreateB2BOrderBody } from './b2b.dto'
import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Res, NotFoundException,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '@erp/types'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { OrdersService } from '../orders/orders.service'
import { PrismaService } from '../common/prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'
import { nextInvoiceNumber } from '../invoices/invoice-number'

@Controller('sites/:siteId/b2b-orders')
@UseGuards(JwtAuthGuard, SiteGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class B2BOrdersController {
  constructor(
    private orders: OrdersService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findB2B(
    @Param('siteId') siteId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.prisma.order.findMany({
      where: {
        siteId,
        channel: 'B2B',
        ...(status ? { status: status as any } : {}),
        ...(clientId ? { b2bClientId: clientId } : {}),
      },
      include: {
        b2bClient: { select: { id: true, name: true, paymentTerms: true } },
        items: true,
        receiptChain: { select: { counter: true, signedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  // Crée une commande B2B (sans passer par la caisse POS)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createB2BOrder(
    @Param('siteId') siteId: string,
    @Body() dto: CreateB2BOrderBody,
    @CurrentUser() user: { organizationId: string },
  ) {
    // Le client doit appartenir à l'organisation (sinon on exposerait sa fiche)
    const client = await this.prisma.b2BClient.findFirst({ where: { id: dto.b2bClientId, organizationId: user.organizationId }, select: { id: true } })
    if (!client) throw new NotFoundException('Client introuvable')

    const checkoutDto = {
      items: dto.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      paymentMode: 'INVOICE' as any,
      channel: 'B2B' as any,
      note: dto.note,
      orderDiscount: dto.orderDiscount,
    }

    const order = await this.orders.checkout(siteId, checkoutDto)

    // Met à jour les champs B2B sur la commande créée
    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        b2bClientId: dto.b2bClientId,
        paymentTerms: dto.paymentTerms ?? 30,
        status: 'PENDING', // B2B démarre en PENDING, pas COMPLETED
      },
      include: {
        items: true,
        b2bClient: true,
        receiptChain: { select: { counter: true } },
      },
    })
  }

  // Génère un numéro de facture et marque comme facturé
  @Post(':id/invoice')
  async generateInvoice(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, siteId, channel: 'B2B' },
      select: { id: true, invoiceNumber: true, site: { select: { organizationId: true } } },
    })
    if (!order) throw new Error('Commande B2B introuvable')
    if (order.invoiceNumber) throw new Error('Facture déjà générée')

    // Même séquence atomique que les autres chemins de facturation (FA-AAAA-NNNN), dans la transaction qui enregistre la facture
    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx, order.site.organizationId)
      const claimed = await tx.order.updateMany({
        where: { id, invoiceNumber: null },
        data: { invoiceNumber, invoicedAt: new Date(), status: 'COMPLETED' },
      })
      if (claimed.count !== 1) throw new Error('Facture déjà générée')
      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: true,
          b2bClient: true,
          receiptChain: { select: { counter: true } },
          site: { include: { organization: true } },
        },
      })
    })
  }

  @Get(':id/invoice')
  async getInvoiceData(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.prisma.order.findFirst({
      where: { id, siteId, channel: 'B2B' },
      include: {
        items: { include: { product: { select: { name: true, subtitle: true } } } },
        b2bClient: true,
        receiptChain: { select: { counter: true, signedAt: true } },
        site: { include: { organization: true } },
      },
    })
  }
}
