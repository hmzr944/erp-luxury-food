import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CompaniesService } from './companies.service'

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  // L'annuaire de l'État limite le débit : on reste bien en dessous
  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query('q') q = '') {
    return this.companies.search(q)
  }
}
