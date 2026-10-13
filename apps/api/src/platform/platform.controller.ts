import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PlatformService } from './platform.service'
import {
  ApplySectorDto,
  AttributeDefinitionDto,
  PaymentMethodDto,
  TaxRateDto,
  UpdatePlatformDto,
} from './dto/platform.dto'

type AuthUser = { organizationId: string }

@Controller('organizations/me/platform')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformController {
  constructor(private platform: PlatformService) {}

  // Lisible par tous les rôles : la caisse s'en sert pour s'adapter
  @Get()
  getConfig(@CurrentUser() user: AuthUser) {
    return this.platform.getConfig(user.organizationId)
  }

  @Put('sector')
  @Roles(Role.OWNER)
  applySector(@CurrentUser() user: AuthUser, @Body() dto: ApplySectorDto) {
    return this.platform.applySector(user.organizationId, dto.sector)
  }

  @Patch()
  @Roles(Role.OWNER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePlatformDto) {
    return this.platform.update(user.organizationId, dto)
  }

  @Post('tax-rates')
  @Roles(Role.OWNER, Role.MANAGER)
  createTaxRate(@CurrentUser() user: AuthUser, @Body() dto: TaxRateDto) {
    return this.platform.upsertTaxRate(user.organizationId, dto)
  }

  @Put('tax-rates/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  updateTaxRate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TaxRateDto) {
    return this.platform.upsertTaxRate(user.organizationId, dto, id)
  }

  @Delete('tax-rates/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  removeTaxRate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.removeTaxRate(user.organizationId, id)
  }

  @Post('payment-methods')
  @Roles(Role.OWNER, Role.MANAGER)
  createPaymentMethod(@CurrentUser() user: AuthUser, @Body() dto: PaymentMethodDto) {
    return this.platform.upsertPaymentMethod(user.organizationId, dto)
  }

  @Put('payment-methods/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  updatePaymentMethod(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PaymentMethodDto) {
    return this.platform.upsertPaymentMethod(user.organizationId, dto, id)
  }

  @Delete('payment-methods/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  disablePaymentMethod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.disablePaymentMethod(user.organizationId, id)
  }

  @Post('attributes')
  @Roles(Role.OWNER, Role.MANAGER)
  createAttribute(@CurrentUser() user: AuthUser, @Body() dto: AttributeDefinitionDto) {
    return this.platform.upsertAttribute(user.organizationId, dto)
  }

  @Put('attributes/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  updateAttribute(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AttributeDefinitionDto) {
    return this.platform.upsertAttribute(user.organizationId, dto, id)
  }

  @Delete('attributes/:id')
  @Roles(Role.OWNER, Role.MANAGER)
  removeAttribute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.removeAttribute(user.organizationId, id)
  }
}
