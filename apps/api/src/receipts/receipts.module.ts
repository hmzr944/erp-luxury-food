import { Module } from '@nestjs/common'
import { ReceiptsController, ReceiptsPublicController } from './receipts.controller'
import { ReceiptsService } from './receipts.service'
import { InvoiceFromReceiptService } from './invoice.service'

@Module({
  controllers: [ReceiptsPublicController, ReceiptsController],
  providers: [ReceiptsService, InvoiceFromReceiptService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
