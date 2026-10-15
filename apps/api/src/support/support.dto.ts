import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator'

// Contexte joint automatiquement par l'application : le commerçant n'a pas
// à expliquer où il se trouve ni quelle caisse il utilise
export class SupportContextDto {
  @IsOptional() @IsString() @MaxLength(40) appVersion?: string
  @IsOptional() @IsString() @MaxLength(300) page?: string
  @IsOptional() @IsString() @MaxLength(120) siteName?: string
  @IsOptional() @IsString() @MaxLength(120) terminalName?: string
  @IsOptional() @IsBoolean() online?: boolean
  @IsOptional() @IsString() @MaxLength(400) userAgent?: string
  @IsOptional() @IsString() @MaxLength(40) screen?: string
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(500, { each: true }) errors?: string[]
}

export class CreateThreadDto {
  @IsString() @IsNotEmpty() @MaxLength(140) subject!: string
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string
  @IsOptional() @IsIn(['NORMAL', 'URGENT']) priority?: 'NORMAL' | 'URGENT'
  @IsOptional() @IsString() @MaxLength(40) siteId?: string
  @IsOptional() @ValidateNested() @Type(() => SupportContextDto) context?: SupportContextDto
}

export class PostMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string
}

export class AgentReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string
  // Statut après la réponse ; par défaut on attend le commerçant
  @IsOptional() @IsIn(['OPEN', 'WAITING_CUSTOMER', 'RESOLVED']) status?: 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED'
}

export class AgentStatusDto {
  @IsIn(['OPEN', 'WAITING_CUSTOMER', 'RESOLVED']) status!: 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED'
}
