import { Type } from 'class-transformer'
import {
  ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator'

export class RefundLineDto {
  @IsString()
  orderItemId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class RefundDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundLineDto)
  lines!: RefundLineDto[]

  // ORIGINAL : même moyen que la vente (carte remboursée sur le TPE connecté)
  @IsIn(['ORIGINAL', 'CASH', 'CREDIT'])
  refundTo!: 'ORIGINAL' | 'CASH' | 'CREDIT'

  @IsBoolean()
  restock!: boolean

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  // Durée de validité de l'avoir ; absent : sans limite
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  creditMonths?: number

  // Identifiant de ce retour, fourni par l'écran : le rejouer ne rembourse pas deux fois
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string

  // Code à 4 chiffres d'un responsable (OWNER ou MANAGER) : demandé à un vendeur
  @IsOptional()
  @IsString()
  @MaxLength(8)
  managerPin?: string
}
