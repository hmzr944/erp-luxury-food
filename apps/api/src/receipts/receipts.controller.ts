import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsEmail } from 'class-validator'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { ReceiptsService } from './receipts.service'

class EmailReceiptDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string
}

// Reçu en ligne, sans compte : lien du QR code imprimé ou affiché
@Controller('receipts')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ReceiptsPublicController {
  constructor(private receipts: ReceiptsService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.receipts.view(token)
  }

  @Get(':token/pdf')
  async pdf(@Param('token') token: string, @Res() res: Response) {
    const { filename, body } = await this.receipts.pdf(token)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(body)
  }
}

// Envoi du reçu par e-mail depuis la caisse
@Controller('sites/:siteId/receipts')
@UseGuards(JwtAuthGuard, SiteGuard)
export class ReceiptsController {
  constructor(private receipts: ReceiptsService) {}

  @Post(':token/email')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  email(@Param('siteId') siteId: string, @Param('token') token: string, @Body() dto: EmailReceiptDto) {
    return this.receipts.email(token, dto.email, siteId)
  }
}
