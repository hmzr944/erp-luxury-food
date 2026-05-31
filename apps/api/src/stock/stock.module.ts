import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { StockController } from './stock.controller'
import { StockService } from './stock.service'
import { StockProcessor } from './stock.processor'

@Module({
  imports: [BullModule.registerQueue({ name: 'stock' })],
  controllers: [StockController],
  providers: [StockService, StockProcessor],
  exports: [StockService],
})
export class StockModule {}
