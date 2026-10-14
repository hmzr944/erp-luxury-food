import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, Matches, Max, MaxLength, IsString, Min, ValidateNested, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'
import { Channel, PaymentMode } from '@erp/types'

// Composant d'une formule : la formule et le numéro de sa ligne dans la vente
export class MenuRefDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(0)
  group!: number
}

// Options, formule et pesée, communs aux ventes du serveur et des caisses
export class ItemCompositionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  modifiers?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => MenuRefDto)
  menu?: MenuRefDto

  // Poids en kg
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999)
  weight?: number

  // Étiquette de balance (EAN-13)
  @IsOptional()
  @Matches(/^2\d{12}$/)
  label?: string
}

export class CheckoutItemDto extends ItemCompositionDto {
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

  // Avoir : son code ; TPE : référence du prestataire
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string
}

export class CheckoutDto {
  // Client non résident fiscal : plafond espèces de 15 000 € au lieu de 1 000 €
  @IsOptional()
  @IsBoolean()
  nonResident?: boolean

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
