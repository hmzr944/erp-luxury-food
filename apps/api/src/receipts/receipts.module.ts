import { Module } from '@nestjs/common'
import { ReceiptsController, ReceiptsPublicController } from './receipts.controller'
import { ReceiptsService } from './receipts.service'

@Module({
  controllers: [ReceiptsPublicController, ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
