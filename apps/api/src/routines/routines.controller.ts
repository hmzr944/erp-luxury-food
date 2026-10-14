import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RoutinesService } from './routines.service'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

class TaskDto {
  @IsOptional() @IsString() @MaxLength(40) key?: string
  @IsString() @MaxLength(80) label!: string
  @IsOptional() @IsString() deadline?: string | null
}

class RoutineSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean
  @IsOptional() @Matches(TIME, { message: 'Heure de fermeture : format HH:MM' }) closingTime?: string
  @IsOptional() @IsString() supplyDeadline?: string | null
  @IsOptional() @IsString() cashDeadline?: string | null
  @IsOptional() @IsArray() @IsInt({ each: true }) days?: number[]
  @IsOptional() @IsInt() reminderMinutes?: number
  @IsOptional() @IsInt() alertAfterMinutes?: number
  @IsOptional() @IsBoolean() autoLock?: boolean
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) notifyEmails?: string[]
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => TaskDto) tasks?: TaskDto[]
}

class CheckDto {
  @IsBoolean() done!: boolean
}

@Controller('sites/:siteId/routine')
@UseGuards(JwtAuthGuard, SiteGuard)
export class RoutinesController {
  constructor(private routines: RoutinesService) {}

  // Lu par la caisse toutes les minutes
  @Get('status')
  status(@Param('siteId') siteId: string) {
    return this.routines.status(siteId)
  }

  @Post('checks/:key')
  check(@Param('siteId') siteId: string, @Param('key') key: string, @Body() dto: CheckDto, @CurrentUser() user: { id: string }) {
    return this.routines.check(siteId, key, dto.done, user)
  }

  @Get('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  settings(@Param('siteId') siteId: string) {
    return this.routines.settings(siteId)
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(@Param('siteId') siteId: string, @Body() dto: RoutineSettingsDto) {
    return this.routines.updateSettings(siteId, dto)
  }
}
