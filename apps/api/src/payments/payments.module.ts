import { Module } from '@nestjs/common'
import { PaymentAccountsController, PaymentDevicesController, TerminalPaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  controllers: [PaymentAccountsController, PaymentDevicesController, TerminalPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
