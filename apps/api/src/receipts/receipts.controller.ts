import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Type } from 'class-transformer'
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { ReceiptsService } from './receipts.service'
import { InvoiceFromReceiptService } from './invoice.service'

class EmailReceiptDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  email!: string
}

class InvoiceCompanyDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string
  @IsOptional() @IsString() @MaxLength(20) siren?: string
  @IsOptional() @IsString() @MaxLength(20) siret?: string
  @IsOptional() @IsString() @MaxLength(20) vatNumber?: string
  @IsOptional() @IsString() @MaxLength(200) address?: string
  @IsOptional() @IsString() @MaxLength(10) zipCode?: string
  @IsOptional() @IsString() @MaxLength(100) city?: string
  @IsOptional() @IsString() @MaxLength(2) country?: string
}

class InvoiceDto {
  @ValidateNested() @Type(() => InvoiceCompanyDto) company!: InvoiceCompanyDto
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide' }) email?: string
}

// Reçu en ligne, sans compte : lien du QR code imprimé ou affiché
@Controller('receipts')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class ReceiptsPublicController {
  constructor(
    private receipts: ReceiptsService,
    private invoices: InvoiceFromReceiptService,
  ) {}

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

  // Facture A4 de la vente, une fois émise
  @Get(':token/invoice')
  async invoicePdf(@Param('token') token: string, @Res() res: Response) {
    const { filename, body } = await this.invoices.pdf(token)
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
  constructor(
    private receipts: ReceiptsService,
    private invoices: InvoiceFromReceiptService,
  ) {}

  // Facture entreprise d'une vente, envoyée au service comptable
  @Post(':token/invoice')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  invoice(@Param('siteId') siteId: string, @Param('token') token: string, @Body() dto: InvoiceDto, @CurrentUser() user: { id: string }) {
    return this.invoices.issue(siteId, token, dto, user)
  }

  @Post(':token/email')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  email(@Param('siteId') siteId: string, @Param('token') token: string, @Body() dto: EmailReceiptDto) {
    return this.receipts.email(token, dto.email, siteId)
  }
}
