import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { ProductsService } from './products.service'
import { StarterService } from './starter.service'
import { CatalogCopyService } from './catalog-copy.service'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireSubscription } from '../common/decorators/require-subscription.decorator'
import { Role } from '@erp/types'
import {
  CategoryDto,
  CreateProductDto,
  ModifierGroupDto,
  ProductOptionDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/product.dto'
import { IsArray, IsNumber, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class PreviewVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  options!: ProductOptionDto[]

  @IsNumber()
  @Min(0)
  price!: number
}

@Controller('sites/:siteId')
@UseGuards(JwtAuthGuard, SiteGuard)
export class ProductsController {
  constructor(
    private products: ProductsService,
    private starter: StarterService,
    private catalogCopy: CatalogCopyService,
  ) {}

  // Copie le catalogue d'un autre site de l'organisation vers ce site (jamais
  // de stock, de vente ni de client) : écriture de catalogue, donc abonnement requis
  @Post('catalog/copy-from/:sourceSiteId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @RequireSubscription()
  copyCatalog(
    @CurrentUser() user: { organizationId: string },
    @Param('siteId') siteId: string,
    @Param('sourceSiteId') sourceSiteId: string,
  ) {
    return this.catalogCopy.copy(siteId, sourceSiteId, user.organizationId)
  }

  // ── Produits ────────────────────────────────────────────────

  @Get('products')
  findAll(
    @Param('siteId') siteId: string,
    @Query('all') all?: string,
  ) {
    return this.products.findAll(siteId, all === 'true')
  }

  @Get('products/barcode/:barcode')
  findByBarcode(@Param('siteId') siteId: string, @Param('barcode') barcode: string) {
    return this.products.findByBarcode(barcode, siteId)
  }

  @Get('products/custom')
  customProduct(@Param('siteId') siteId: string) {
    return this.products.customProduct(siteId)
  }

  // Champs de la fiche produit (millésime, origine...) selon les packs de l'organisation
  @Get('products/attribute-definitions')
  attributeDefinitions(@Param('siteId') siteId: string) {
    return this.products.attributeDefinitions(siteId)
  }

  @Get('products/gift-card')
  giftCardProduct(@Param('siteId') siteId: string) {
    return this.products.giftCardProduct(siteId)
  }

  // Catalogue d'exemple de l'inscription : combien il en reste, et les retirer
  @Get('products/samples')
  samples(@Param('siteId') siteId: string) {
    return this.starter.count(siteId).then((count) => ({ count }))
  }

  @Delete('products/samples')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  removeSamples(@Param('siteId') siteId: string) {
    return this.starter.remove(siteId)
  }

  @Get('products/lookup/:code')
  lookup(@Param('siteId') siteId: string, @Param('code') code: string) {
    return this.products.lookup(siteId, code)
  }

  @Post('products/variants/preview')
  @HttpCode(HttpStatus.OK)
  previewVariants(@Body() dto: PreviewVariantsDto) {
    return this.products.previewVariants(dto.options, dto.price)
  }

  @Get('products/:id')
  findById(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.products.findById(id, siteId)
  }

  @Post('products')
  @RequireSubscription()
  create(@Param('siteId') siteId: string, @Body() dto: CreateProductDto) {
    return this.products.create(siteId, dto)
  }

  @Patch('products/:id')
  @RequireSubscription()
  update(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, siteId, dto)
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.products.remove(id, siteId)
  }

  // ── Options et suppléments ──────────────────────────────────

  @Get('modifier-groups')
  findModifierGroups(@Param('siteId') siteId: string) {
    return this.products.findModifierGroups(siteId)
  }

  @Post('modifier-groups')
  @RequireSubscription()
  createModifierGroup(@Param('siteId') siteId: string, @Body() dto: ModifierGroupDto) {
    return this.products.createModifierGroup(siteId, dto)
  }

  @Patch('modifier-groups/:id')
  @RequireSubscription()
  updateModifierGroup(@Param('siteId') siteId: string, @Param('id') id: string, @Body() dto: ModifierGroupDto) {
    return this.products.updateModifierGroup(id, siteId, dto)
  }

  @Delete('modifier-groups/:id')
  @HttpCode(HttpStatus.OK)
  removeModifierGroup(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.products.removeModifierGroup(id, siteId)
  }

  // ── Catégories ──────────────────────────────────────────────

  @Get('categories')
  findCategories(@Param('siteId') siteId: string) {
    return this.products.findCategories(siteId)
  }

  @Post('categories')
  @RequireSubscription()
  createCategory(
    @Param('siteId') siteId: string,
    @Body() dto: CategoryDto,
  ) {
    return this.products.createCategory(siteId, dto)
  }

  @Patch('categories/:id')
  @RequireSubscription()
  updateCategory(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.products.updateCategory(id, siteId, dto)
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  removeCategory(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.products.removeCategory(id, siteId)
  }
}
