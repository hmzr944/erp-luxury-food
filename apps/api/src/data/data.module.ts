import { Module } from '@nestjs/common'
import { OrganizationDataController, SiteDataController } from './data.controller'
import { DataService } from './data.service'

@Module({
  controllers: [SiteDataController, OrganizationDataController],
  providers: [DataService],
})
export class DataModule {}
