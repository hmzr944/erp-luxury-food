import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { StarterService } from './starter.service'
import { ProductsService } from './products.service'

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, StarterService],
  exports: [ProductsService, StarterService],
})
export class ProductsModule {}
