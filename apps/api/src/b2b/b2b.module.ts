import { Module } from '@nestjs/common'
import { B2BClientsController } from './b2b-clients.controller'
import { B2BClientsService } from './b2b-clients.service'
import { B2BOrdersController } from './b2b-orders.controller'

@Module({
  controllers: [B2BClientsController, B2BOrdersController],
  providers: [B2BClientsService],
  exports: [B2BClientsService],
})
export class B2BModule {}
