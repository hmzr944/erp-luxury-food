import { Module } from '@nestjs/common'
import { CreditsController, OrdersController, PickupController } from './orders.controller'
import { RefundsService } from './refunds.service'
import { PaymentsModule } from '../payments/payments.module'
import { OrdersService } from './orders.service'
import { OrdersGateway } from './orders.gateway'
import { ComplianceModule } from '../compliance/compliance.module'
import { PrintingModule } from '../printing/printing.module'
import { StockModule } from '../stock/stock.module'

@Module({
  imports: [ComplianceModule, PrintingModule, StockModule, PaymentsModule],
  controllers: [OrdersController, PickupController, CreditsController],
  providers: [OrdersService, RefundsService, OrdersGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
