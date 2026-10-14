import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { AttributeType, Pack, PaymentKind, Sector } from '@erp/types'

export class ApplySectorDto {
  @IsEnum(Sector)
  sector!: Sector
}

// Étiquette de balance : préfixe EAN-13, prix ou poids intégré
export class ScaleBarcodeRuleDto {
  @Matches(/^2\d$/, { message: 'Préfixe entre 20 et 29' })
  prefix!: string

  @IsIn(['PRICE', 'WEIGHT'])
  mode!: 'PRICE' | 'WEIGHT'

  @IsInt()
  @Min(4)
  @Max(6)
  codeLength!: number
}

export class UpdatePlatformDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ScaleBarcodeRuleDto)
  scaleBarcodes?: ScaleBarcodeRuleDto[]

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Pack, { each: true })
  packs?: Pack[]

  @IsOptional()
  @IsBoolean()
  priceIncludesTax?: boolean

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string
}

export class TaxRateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate!: number

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

export class PaymentMethodDto {
  @Matches(/^[A-Z0-9_]{2,32}$/, { message: 'code : majuscules, chiffres et _ uniquement' })
  code!: string

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string

  @IsEnum(PaymentKind)
  kind!: PaymentKind

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsInt()
  position?: number

  // Titre-restaurant : articles éligibles seulement, plafond, pas de rendu
  @IsOptional()
  @IsBoolean()
  mealVoucher?: boolean

  @IsOptional()
  @IsBoolean()
  giveChange?: boolean

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number | null

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean
}

export class AttributeDefinitionDto {
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, { message: 'clé : lettres, chiffres et _, commence par une lettre' })
  key!: string

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string

  @IsEnum(AttributeType)
  type!: AttributeType

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]

  @IsOptional()
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @IsInt()
  position?: number
}
