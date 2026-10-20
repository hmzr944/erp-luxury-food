import { Module } from '@nestjs/common'
import { SitesController } from './sites.controller'
import { BillingModule } from '../billing/billing.module'
import { SitesService } from './sites.service'
import { ProductsModule } from '../products/products.module'

@Module({
  imports: [BillingModule, ProductsModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
