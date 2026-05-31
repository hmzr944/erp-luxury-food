import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { DashboardService } from './dashboard.service'

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
@UseGuards(JwtAuthGuard)
export class ConsolidatedDashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  getConsolidated(@CurrentUser() user: { organizationId: string }) {
    return this.dashboard.getMultiSiteSummary(user.organizationId)
  }
}
