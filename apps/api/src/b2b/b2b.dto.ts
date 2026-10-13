import { PartialType } from '@nestjs/mapped-types'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator'

export class CreateB2BClientBody {
  @IsString() @MaxLength(120) name!: string
  @IsOptional() @Matches(/^\d{14}$/, { message: 'SIRET : 14 chiffres' }) siret?: string
  @IsOptional() @IsString() @MaxLength(20) vatNumber?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(200) address?: string
  @IsOptional() @IsString() @MaxLength(100) city?: string
  @IsOptional() @IsString() @MaxLength(12) zipCode?: string
  @IsOptional() @IsString() @MaxLength(60) country?: string
  @IsOptional() @IsNumber() @Min(0) @Max(100) discount?: number
  @IsOptional() @IsInt() @Min(0) @Max(120) paymentTerms?: number
  @IsOptional() @IsString() @MaxLength(1000) notes?: string
}

export class UpdateB2BClientBody extends PartialType(CreateB2BClientBody) {}

class B2BItem {
  @IsString() productId!: string
  @IsInt() @Min(1) @Max(100_000) quantity!: number
}

export class CreateB2BOrderBody {
  @IsString() b2bClientId!: string
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => B2BItem) items!: B2BItem[]
  @IsOptional() @IsInt() @Min(0) @Max(120) paymentTerms?: number
  @IsOptional() @IsString() @MaxLength(500) note?: string
  @IsOptional() @IsNumber() @Min(0) orderDiscount?: number
}
