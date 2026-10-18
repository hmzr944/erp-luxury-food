import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class PinLoginDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsISO8601() signedAt!: string
  @IsString() @MaxLength(200) signature!: string
  @Matches(/^\d{4}$/, { message: 'Le code fait 4 chiffres' }) pin!: string
  // Reprise sans réseau confirmée au retour de la connexion : heure de la reprise, pour le journal
  @IsOptional() @IsISO8601() offlineAt?: string
  // Personne reconnue hors ligne : le code doit être toujours le sien
  @IsOptional() @IsString() @MaxLength(40) offlineUserId?: string
}
