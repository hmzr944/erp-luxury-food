import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { FacturxService } from './facturx.service'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, FacturxService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
