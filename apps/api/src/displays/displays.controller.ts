import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, IsString, Matches } from 'class-validator'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { DisplaysService } from './displays.service'

class PairDisplayDto {
  @Matches(/^\d{3}\s?\d{3}$/, { message: 'Code à 6 chiffres' })
  code!: string

  @IsOptional()
  @IsString()
  terminalId?: string
}

// Tablette, sans compte : elle s'identifie par son jeton
@Controller('displays')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class DisplaysPublicController {
  constructor(private displays: DisplaysService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create() {
    return this.displays.create()
  }

  @Get('me')
  status(@Headers('x-display-token') token?: string) {
    return this.displays.status(token ?? '')
  }
}

@Controller('sites/:siteId/displays')
@UseGuards(JwtAuthGuard, SiteGuard)
export class DisplaysController {
  constructor(private displays: DisplaysService) {}

  @Get()
  list(@Param('siteId') siteId: string) {
    return this.displays.list(siteId)
  }

  @Post('pair')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  pair(@Param('siteId') siteId: string, @Body() dto: PairDisplayDto) {
    return this.displays.pair(siteId, dto.code, dto.terminalId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  unpair(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.displays.unpair(siteId, id)
  }
}
