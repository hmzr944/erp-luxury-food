import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'
import { StockProcessor } from './stock.processor'
import { StockNetworkController } from './stock-network.controller'
import { StockNetworkService } from './stock-network.service'
import { InventoryModule } from '../inventory/inventory.module'
import { LotsController } from './lots.controller'
import { LotsService } from './lots.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'stock' }), InventoryModule],
  controllers: [StockController, StockNetworkController, LotsController],
  providers: [StockService, StockProcessor, StockNetworkService, LotsService],
  exports: [StockService],
})
export class StockModule {}
