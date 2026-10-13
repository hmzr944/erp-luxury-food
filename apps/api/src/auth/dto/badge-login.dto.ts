import { IsISO8601, IsString, MaxLength } from 'class-validator'

export class BadgeLoginDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsISO8601() signedAt!: string
  @IsString() @MaxLength(200) signature!: string
  // Contenu du QR ou identifiant du badge NFC
  @IsString() @MaxLength(120) code!: string
}
