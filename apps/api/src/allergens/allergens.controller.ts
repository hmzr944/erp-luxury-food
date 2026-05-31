import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { AllergensService } from './allergens.service'

@Controller('allergens')
export class AllergensPublicController {
  constructor(private allergens: AllergensService) {}

  // Route publique — liste des 14 INCO
  @Get()
  findAll() {
    return this.allergens.findAll()
  }
}

@Controller('sites/:siteId/allergens')
@UseGuards(JwtAuthGuard, SiteGuard)
export class AllergensController {
  constructor(private allergens: AllergensService) {}

  @Get()
  getProductsWithAllergens(@Param('siteId') siteId: string) {
    return this.allergens.getProductsWithAllergens(siteId)
  }

  @Get(':productId')
  getProductAllergens(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
  ) {
    return this.allergens.getProductAllergens(productId, siteId)
  }

  @Put(':productId')
  setProductAllergens(
    @Param('siteId') siteId: string,
    @Param('productId') productId: string,
    @Body() dto: { allergens: Array<{ allergenId: string; traces: boolean }> },
  ) {
    return this.allergens.setProductAllergens(productId, siteId, dto.allergens)
  }
}
