import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'
import { CORRECTION_REASON_CODES, type CorrectionReason } from '../stock/stock-rules'

export class StartInventoryDto {
  // Absent : tout le catalogue
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string
}

export class CountLineDto {
  // null remet la ligne à « non comptée »
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantité : 3 décimales au plus' })
  @Min(0, { message: 'La quantité comptée ne peut pas être négative' })
  countedQty?: number | null

  @IsOptional()
  @IsIn([...CORRECTION_REASON_CODES, ''], { message: 'Motif : casse, vol, erreur de saisie, don ou autre' })
  reasonCode?: CorrectionReason | ''

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string
}
