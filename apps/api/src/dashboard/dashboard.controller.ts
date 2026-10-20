import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '@erp/types'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { DashboardService } from './dashboard.service'
import { isPeriodKey } from './period'

@Controller('sites/:siteId/dashboard')
@UseGuards(JwtAuthGuard, SiteGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  getSummary(@Param('siteId') siteId: string) {
    return this.dashboard.getDailySummary(siteId)
  }

  @Get('realtime')
  getRealtime(@Param('siteId') siteId: string) {
    return this.dashboard.getRealtimeKPIs(siteId)
  }
}

@Controller('dashboard/consolidated')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class ConsolidatedDashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  getConsolidated(@CurrentUser() user: { organizationId: string }, @Query('period') period?: string) {
    if (period !== undefined && !isPeriodKey(period)) throw new BadRequestException('Période inconnue')
    return this.dashboard.getMultiSiteSummary(user.organizationId, period)
  }
}
