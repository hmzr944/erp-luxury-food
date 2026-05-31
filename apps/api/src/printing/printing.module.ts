import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { PrintingService } from './printing.service'
import { PrintingProcessor } from './printing.processor'

@Module({
  imports: [BullModule.registerQueue({ name: 'printing' })],
  providers: [PrintingService, PrintingProcessor],
  exports: [PrintingService],
})
export class PrintingModule {}
