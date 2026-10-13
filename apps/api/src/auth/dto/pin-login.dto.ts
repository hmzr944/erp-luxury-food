import { IsISO8601, IsString, Matches, MaxLength } from 'class-validator'

export class PinLoginDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsISO8601() signedAt!: string
  @IsString() @MaxLength(200) signature!: string
  @Matches(/^\d{4}$/, { message: 'Le code fait 4 chiffres' }) pin!: string
}
