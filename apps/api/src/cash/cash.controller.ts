import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CashService } from './cash.service'

class OpenDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000) amount!: number
  @IsOptional() @IsString() @MaxLength(200) note?: string
}

class CloseDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsObject() denominations!: Record<string, number>
  @IsOptional() @IsString() @MaxLength(200) reason?: string
}

class SettingsDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000) cashFloat?: number
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000) cashTolerance?: number
}

@Controller('sites/:siteId/cash')
@UseGuards(JwtAuthGuard, SiteGuard)
export class CashController {
  constructor(private cash: CashService) {}

  @Get('current')
  current(@Param('siteId') siteId: string, @Query('terminalId') terminalId: string) {
    return this.cash.current(siteId, terminalId)
  }

  @Post('open')
  open(@Param('siteId') siteId: string, @Body() dto: OpenDto, @CurrentUser() user: { id: string }) {
    return this.cash.open(siteId, user.id, dto)
  }

  @Post('close')
  @HttpCode(HttpStatus.OK)
  close(@Param('siteId') siteId: string, @Body() dto: CloseDto, @CurrentUser() user: { id: string }) {
    return this.cash.close(siteId, user.id, dto)
  }

  @Get('sessions')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  history(@Param('siteId') siteId: string) {
    return this.cash.history(siteId)
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  settings(@Param('siteId') siteId: string, @Body() dto: SettingsDto) {
    return this.cash.updateSettings(siteId, dto)
  }
}
