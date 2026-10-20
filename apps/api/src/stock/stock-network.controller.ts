import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { StockNetworkService } from './stock-network.service'
import type { StockSort } from './stock-network'

const num = (v?: string) => (v && /^\d{1,6}$/.test(v) ? parseInt(v, 10) : undefined)

// Stock de tous les sites de l'organisation, réservé au titulaire et au gérant
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class StockNetworkController {
  constructor(private network: StockNetworkService) {}

  @Get('consolidated')
  consolidated(
    @CurrentUser() user: { organizationId: string },
    @Query('siteIds') siteIds?: string,
    @Query('q') q?: string,
    @Query('low') low?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.network.consolidated(user.organizationId, {
      siteIds: typeof siteIds === 'string' ? siteIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      q: typeof q === 'string' ? q.slice(0, 100) : undefined,
      lowOnly: low === '1' || low === 'true',
      sort: (['name', 'total', 'low'] as const).includes(sort as StockSort) ? (sort as StockSort) : 'name',
      order: order === 'desc' ? 'desc' : 'asc',
      page: num(page),
      pageSize: num(pageSize),
    })
  }
}
