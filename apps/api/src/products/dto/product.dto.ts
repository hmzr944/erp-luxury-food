import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { PartialType } from '@nestjs/mapped-types'
import { TrackingMode } from '@erp/types'

export class ProductOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  values!: string[]
}

export class VariantDto {
  // Présent pour une variante existante : elle est mise à jour, pas recréée
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number

  @IsOptional()
  @IsString()
  barcode?: string

  @IsOptional()
  @IsString()
  sku?: string

  @IsOptional()
  @IsObject()
  options?: Record<string, string>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class MenuChoiceDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  // Supplément demandé pour ce choix dans la formule
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  supplement?: number
}

export class MenuStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsInt()
  @Min(0)
  @Max(10)
  minSelect!: number

  @IsInt()
  @Min(1)
  @Max(10)
  maxSelect!: number

  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => MenuChoiceDto)
  choices!: MenuChoiceDto[]
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  sku?: string

  @IsOptional()
  @IsString()
  barcode?: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number

  // Absent : taux par défaut de l'organisation
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsString()
  imageUrl?: string

  // Payable en titre-restaurant. Absent : oui pour l'alimentaire à 5,5 % ou 10 %
  @IsOptional()
  @IsBoolean()
  mealVoucherEligible?: boolean

  // Absent : suivi par défaut du secteur
  @IsOptional()
  @IsEnum(TrackingMode)
  tracking?: TrackingMode

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>

  // Groupes d'options proposés à la vente, dans l'ordre
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  modifierGroupIds?: string[]

  // Formule : prix unique, étapes de choix
  @IsOptional()
  @IsBoolean()
  isMenu?: boolean

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MenuStepDto)
  menuSteps?: MenuStepDto[]

  // Seuil d'alerte de stock bas : l'alerte se déclenche quand le stock
  // descend à ce niveau ou en dessous. null ou absent : pas d'alerte
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: "Seuil d'alerte : 3 décimales au plus" })
  @Min(0, { message: "Le seuil d'alerte ne peut pas être négatif" })
  @Max(1_000_000, { message: "Seuil d'alerte trop élevé" })
  alertAt?: number | null

  // Vente au poids : le prix est le prix au kilo
  @IsOptional()
  @IsBoolean()
  soldByWeight?: boolean

  // Code article de la balance étiqueteuse
  @IsOptional()
  @Matches(/^\d{1,6}$/, { message: 'Code balance : 1 à 6 chiffres' })
  scaleCode?: string | null

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  options?: ProductOptionDto[]

  // Absent alors que des options sont fournies : toutes les combinaisons
  // sont générées au prix du produit
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[]
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class CategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  position?: number
}

export class UpdateCategoryDto extends PartialType(CategoryDto) {}

export class ModifierDto {
  // Présente pour une option existante : mise à jour, pas recréée
  @IsOptional()
  @IsString()
  id?: string

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number
}

export class ModifierGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsInt()
  @Min(0)
  @Max(20)
  minSelect!: number

  // Absent ou null : sans limite
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect?: number | null

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ModifierDto)
  modifiers!: ModifierDto[]
}
