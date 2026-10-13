import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  MaxLength,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { Channel, PaymentMode } from '@erp/types'

export class CheckoutItemDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsInt()
  @Min(1)
  quantity!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number

  // Obligatoire pour un produit suivi par numéro de série
  @IsOptional()
  @IsString()
  serialNumber?: string

  // Article libre uniquement : prix et taux saisis en caisse
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate?: number

  // Article libre : nom saisi en caisse
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customName?: string
}

export class CheckoutPaymentDto {
  @IsString()
  code!: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number
}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[]

  // Paiements détaillés (codes des moyens de paiement de l'organisation).
  // Absent : un seul paiement du montant total avec paymentMode.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments?: CheckoutPaymentDto[]

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode

  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  orderDiscount?: number

  @IsOptional()
  @IsNumber()
  printerId?: number
}
