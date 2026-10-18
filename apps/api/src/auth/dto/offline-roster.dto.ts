import { IsISO8601, IsString, MaxLength } from 'class-validator'

// Preuve de la caisse : « pin-offline:<caisse>:<heure> » signé par sa clé
export class OfflineRosterDto {
  @IsString() @MaxLength(40) terminalId!: string
  @IsISO8601() signedAt!: string
  @IsString() @MaxLength(200) signature!: string
}
