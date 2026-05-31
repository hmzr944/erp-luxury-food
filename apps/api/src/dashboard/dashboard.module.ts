import { Module } from '@nestjs/common'
import { DashboardController, ConsolidatedDashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  controllers: [DashboardController, ConsolidatedDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
