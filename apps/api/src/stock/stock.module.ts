import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'
import { StockProcessor } from './stock.processor'
import { StockNetworkController } from './stock-network.controller'
import { StockNetworkService } from './stock-network.service'

@Module({
  imports: [BullModule.registerQueue({ name: 'stock' })],
  controllers: [StockController, StockNetworkController],
  providers: [StockService, StockProcessor, StockNetworkService],
  exports: [StockService],
})
export class StockModule {}
