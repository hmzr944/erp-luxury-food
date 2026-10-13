import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { IsIn } from 'class-validator'
import { Role, type PlanCode } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { BillingService } from './billing.service'

class CheckoutDto {
  @IsIn(['STARTER', 'PRO'])
  plan!: PlanCode
}

type AuthUser = { id: string; email: string; organizationId: string; role?: string }

@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: AuthUser) {
    return this.billing.status(user.organizationId, user.role)
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user.organizationId, user.email, dto.plan)
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  portal(@CurrentUser() user: AuthUser) {
    return this.billing.portal(user.organizationId)
  }

  // Appelé par Stripe ; authentifié par la signature, pas par un compte
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.billing.webhook(req.rawBody, signature)
  }
}
