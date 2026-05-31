import { Module } from '@nestjs/common'
import { AllergensController, AllergensPublicController } from './allergens.controller'
import { AllergensService } from './allergens.service'

@Module({
  controllers: [AllergensController, AllergensPublicController],
  providers: [AllergensService],
  exports: [AllergensService],
})
export class AllergensModule {}
