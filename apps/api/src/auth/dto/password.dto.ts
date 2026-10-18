import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string
}

// Même politique de mot de passe qu'à l'inscription
export class ResetPasswordDto {
  @IsString()
  @MaxLength(100)
  token!: string

  @IsString()
  @MinLength(10, { message: 'Mot de passe : 10 caractères minimum' })
  @MaxLength(128)
  password!: string
}
