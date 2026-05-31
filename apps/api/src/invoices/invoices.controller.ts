import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { InvoicesService } from './invoices.service'
import { PrismaService } from '../common/prisma/prisma.service'

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private invoices: InvoicesService,
    private prisma: PrismaService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: { organizationId: string },
    @Query('clientId') clientId?: string,
    @Query('year') year?: string,
  ) {
    return this.invoices.getInvoices(user.organizationId, {
      clientId,
      year: year ? parseInt(year) : undefined,
    })
  }

  @Post('sites/:siteId/orders/:orderId/invoice')
  @UseGuards(SiteGuard)
  @HttpCode(HttpStatus.CREATED)
  generateInvoice(
    @CurrentUser() user: { organizationId: string },
    @Param('siteId') siteId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.invoices.invoiceOrder(orderId, siteId, user.organizationId)
  }

  @Get(':orderId/facturx')
  async exportFacturX(
    @CurrentUser() user: { organizationId: string },
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const [xml, order] = await Promise.all([
      this.invoices.exportFacturX(orderId, user.organizationId),
      this.prisma.order.findFirst({
        where: { id: orderId },
        select: { invoiceNumber: true },
      }),
    ])

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${order?.invoiceNumber ?? 'facture'}.xml"`,
    )
    res.send(xml)
  }

  @Patch(':orderId/status')
  updateStatus(
    @CurrentUser() user: { organizationId: string },
    @Param('orderId') orderId: string,
    @Body('status') status: 'PAID' | 'REFUSED',
  ) {
    return this.invoices.updateStatus(orderId, user.organizationId, status)
  }
}
