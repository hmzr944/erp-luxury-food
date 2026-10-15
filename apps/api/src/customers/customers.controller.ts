import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CustomersService } from './customers.service'

class CustomerDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string
  @IsOptional() @IsString() @MaxLength(60) lastName?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide' }) email?: string
  @IsOptional() @IsBoolean() marketingOptIn?: boolean
}

class LoyaltyRulesDto {
  @IsOptional() @IsBoolean() enabled?: boolean
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) pointsPerEuro?: number
  @IsOptional() @IsInt() @Min(1) @Max(100_000) threshold?: number
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000) reward?: number
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(120) giftCardMonths?: number | null
}

class AdjustDto {
  @IsInt() @Min(-100_000) @Max(100_000) points!: number
  @IsString() @MaxLength(200) note!: string
}

type Actor = { id: string; organizationId: string; role: string }

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Get('loyalty')
  rules(@CurrentUser() user: Actor) {
    return this.customers.rules(user.organizationId)
  }

  @Put('loyalty')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  updateRules(@CurrentUser() user: Actor, @Body() dto: LoyaltyRulesDto) {
    return this.customers.updateRules(user.organizationId, dto)
  }

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  search(@CurrentUser() user: Actor, @Query('q') q = '') {
    // Liste complète sans recherche : gérants seulement (données personnelles)
    if (!q.trim() && user.role !== Role.OWNER && user.role !== Role.MANAGER) return []
    return this.customers.search(user.organizationId, q)
  }

  @Post()
  create(@CurrentUser() user: Actor, @Body() dto: CustomerDto) {
    return this.customers.create(user.organizationId, dto)
  }

  @Get(':id')
  get(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.customers.get(user.organizationId, id)
  }

  @Post(':id/adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  adjust(@CurrentUser() user: Actor, @Param('id') id: string, @Body() dto: AdjustDto) {
    return this.customers.adjust(user.organizationId, id, dto, user)
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.customers.remove(user.organizationId, id, user)
  }
}
