import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  MaxLength,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CheckoutPaymentDto } from './checkout.dto'

export class SignedSaleItemDto {
  @IsString()
  productId!: string

  @IsOptional()
  @IsString()
  variantId?: string

  @IsInt()
  @Min(1)
  quantity!: number

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxRate!: number

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number

  @IsOptional()
  @IsString()
  serialNumber?: string

  // Article libre : nom saisi en caisse
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customName?: string
}

export class TerminalReceiptDto {
  @IsInt()
  @Min(1)
  counter!: number

  @Matches(/^[0-9a-f]{64}$/)
  previousHash!: string

  @Matches(/^[0-9a-f]{64}$/)
  hash!: string

  @IsString()
  @Length(40, 200)
  signature!: string

  @IsDateString()
  signedAt!: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number
}

// Vente signée par une caisse, envoyée dès que le réseau le permet
export class SyncSaleDto {
  @IsUUID()
  clientId!: string

  @IsString()
  terminalId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SignedSaleItemDto)
  items!: SignedSaleItemDto[]

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments!: CheckoutPaymentDto[]

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  orderDiscount?: number

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsString()
  note?: string

  @ValidateNested()
  @Type(() => TerminalReceiptDto)
  receipt!: TerminalReceiptDto
}
