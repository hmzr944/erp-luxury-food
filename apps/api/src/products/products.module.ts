import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { StarterService } from './starter.service'
import { ProductsService } from './products.service'
import { CatalogCopyService } from './catalog-copy.service'

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, StarterService, CatalogCopyService],
  exports: [ProductsService, StarterService, CatalogCopyService],
})
export class ProductsModule {}
