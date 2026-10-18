import { Transform } from 'class-transformer'
import { Equals, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { METIERS, Sector } from '@erp/types'

export class RegisterDto {
  @IsEnum(Sector)
  sector!: Sector

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  businessName!: string

  // Nom de la première boutique ; par défaut celui du commerce
  @IsOptional()
  @IsString()
  @MaxLength(80)
  siteName?: string

  // Facultatifs : l'inscription ne demande que l'e-mail, le mot de passe et le nom de la boutique
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string

  // Métier choisi (boulangerie, mode...) : catalogue d'exemple et réglages fins
  @IsOptional()
  @IsIn(METIERS.map((m) => m.key))
  metier?: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(10, { message: 'Mot de passe : 10 caractères minimum' })
  @MaxLength(128)
  password!: string

  // CGU, CGV et politique de confidentialité : case à cocher obligatoire. Seul
  // le booléen true compte : la conversion implicite ferait de "false" un true
  @Transform(({ obj }) => obj.acceptTerms === true)
  @Equals(true, { message: 'Acceptez les conditions générales et la politique de confidentialité pour continuer' })
  acceptTerms!: boolean
}
