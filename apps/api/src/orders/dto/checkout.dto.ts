import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
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
}

export class CheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[]

  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode

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
