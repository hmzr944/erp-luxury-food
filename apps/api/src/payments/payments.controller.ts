import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import {
  IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator'
import { PaymentProvider } from '@prisma/client'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PaymentsService } from './payments.service'

class AccountDto {
  @IsObject()
  credentials!: Record<string, string>
}

class AddressDto {
  @IsString() @MinLength(1) line1!: string
  @IsString() @MinLength(1) city!: string
  @IsString() @MinLength(1) postalCode!: string
  @IsString() @Length(2, 2) country!: string
}

class PairDto {
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto
}

class StartDto {
  @IsString()
  deviceId!: string

  // En centimes : 1 € minimum, 50 000 € maximum par passage
  @IsInt()
  @Min(100)
  @Max(5_000_000)
  amount!: number

  @IsOptional()
  @IsString()
  clientSaleId?: string

  // Annule la demande en attente sur ce TPE avant d'envoyer celle-ci
  @IsOptional()
  @IsBoolean()
  force?: boolean
}

class SimulateDto {
  @IsBoolean()
  approve!: boolean
}

@Controller('organizations/me/payment-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
export class PaymentAccountsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: { organizationId: string }) {
    return this.payments.listAccounts(user.organizationId)
  }

  @Put(':provider')
  save(
    @CurrentUser() user: { organizationId: string },
    @Param('provider') provider: string,
    @Body() dto: AccountDto,
  ) {
    return this.payments.saveAccount(user.organizationId, this.provider(provider), dto.credentials)
  }

  @Delete(':provider')
  remove(@CurrentUser() user: { organizationId: string }, @Param('provider') provider: string) {
    return this.payments.removeAccount(user.organizationId, this.provider(provider))
  }

  private provider(p: string): PaymentProvider {
    const v = p.toUpperCase()
    if (!(v in PaymentProvider)) throw new BadRequestException('Prestataire inconnu')
    return v as PaymentProvider
  }
}

@Controller('sites/:siteId/payment-devices')
@UseGuards(JwtAuthGuard, SiteGuard, RolesGuard)
export class PaymentDevicesController {
  constructor(private payments: PaymentsService) {}

  @Get()
  list(@Param('siteId') siteId: string) {
    return this.payments.listDevices(siteId)
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  pair(@Param('siteId') siteId: string, @Body() dto: PairDto) {
    return this.payments.pairDevice(siteId, dto)
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.payments.removeDevice(siteId, id)
  }

  // Écran du TPE virtuel
  @Get(':id/pending')
  pending(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.payments.pendingForDevice(siteId, id)
  }
}

@Controller('sites/:siteId/terminal-payments')
@UseGuards(JwtAuthGuard, SiteGuard)
export class TerminalPaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post()
  start(@Param('siteId') siteId: string, @Body() dto: StartDto, @CurrentUser() user: { id: string }) {
    return this.payments.start(siteId, dto, user.id)
  }

  @Get(':id')
  get(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.payments.get(siteId, id)
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.payments.cancel(siteId, id)
  }

  @Post(':id/simulate')
  @HttpCode(HttpStatus.OK)
  simulate(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: SimulateDto) {
    return this.payments.simulate(siteId, id, dto.approve)
  }
}

