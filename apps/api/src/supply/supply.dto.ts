import { Type } from 'class-transformer'
import {
  IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator'

export class SupplySettingsDto {
  @IsOptional() @IsBoolean() isSupplier?: boolean
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure attendue au format HH:MM' }) orderCutoff?: string
  @IsOptional() @IsInt() @Min(0) @Max(14) leadDays?: number
}

export class CatalogItemDto {
  @IsOptional() @IsBoolean() orderable?: boolean
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) supplyPrice?: number | null
  @IsOptional() @IsString() @MaxLength(30) supplyUnit?: string | null
}

export class SupplyLineDto {
  @IsString() productId!: string
  @IsOptional() @IsString() variantId?: string | null
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) quantity!: number
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) suggested?: number | null
}

export class SaveSupplyOrderDto {
  @IsString() supplierId!: string
  @Matches(/^\d{4}-\d{2}-\d{2}$/) deliveryDay!: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => SupplyLineDto) lines!: SupplyLineDto[]
  @IsOptional() @IsString() @MaxLength(500) note?: string
  @IsBoolean() send!: boolean
}

export class PreparedLineDto {
  @IsString() lineId!: string
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) prepared!: number
}

export class ShipDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PreparedLineDto) lines?: PreparedLineDto[]
}

export class ReceivedLineDto {
  @IsString() lineId!: string
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) received!: number
  @IsOptional() @IsString() @MaxLength(200) issue?: string
}

export class ReceiveDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReceivedLineDto) lines?: ReceivedLineDto[]
  @IsOptional() @IsString() @MaxLength(500) note?: string
}

export class StartProductionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) day!: string
}

export class SupplyAlertDto {
  @IsOptional() @IsString() @MaxLength(80) cause?: string
  @IsOptional() @IsString() @MaxLength(120) productName?: string
  @IsOptional() @IsInt() @Min(10) @Max(100) reductionPct?: number
  @IsOptional() @IsString() @MaxLength(240) message?: string
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) day?: string
}
