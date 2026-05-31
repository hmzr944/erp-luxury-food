import { Module } from '@nestjs/common'
import { OrdersController, PickupController } from './orders.controller'
import { OrdersService } from './orders.service'
import { OrdersGateway } from './orders.gateway'
import { ComplianceModule } from '../compliance/compliance.module'
import { PrintingModule } from '../printing/printing.module'
import { StockModule } from '../stock/stock.module'

@Module({
  imports: [ComplianceModule, PrintingModule, StockModule],
  controllers: [OrdersController, PickupController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
