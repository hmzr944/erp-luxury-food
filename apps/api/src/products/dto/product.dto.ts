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

  // Absent : suivi par défaut du secteur
  @IsOptional()
  @IsEnum(TrackingMode)
  tracking?: TrackingMode

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>

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
