import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { Sector } from '@erp/types'

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

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  @MaxLength(128)
  password!: string
}
