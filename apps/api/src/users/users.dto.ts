import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { Role } from '@erp/types'

export class CreateUserDto {
  @IsEmail() @MaxLength(200) email!: string
  @IsString() @MinLength(1) @MaxLength(60) firstName!: string
  @IsString() @MinLength(1) @MaxLength(60) lastName!: string
  @IsEnum(Role) role!: Role
  @IsString() @MinLength(10, { message: 'Mot de passe : 10 caractères minimum' }) @MaxLength(128) password!: string
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) siteIds?: string[]
}

export class UpdateRoleDto {
  @IsEnum(Role) role!: Role
}

export class UpdateSitesDto {
  @IsArray() @ArrayMinSize(1, { message: 'Au moins une boutique' }) @ArrayMaxSize(200) @IsString({ each: true }) siteIds!: string[]
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) firstName?: string
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) lastName?: string
  @IsOptional() @IsEmail() @MaxLength(200) email?: string
  // Changer d'e-mail demande le mot de passe actuel
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string
}

export class UpdatePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string
  @IsString() @MinLength(10, { message: 'Mot de passe : 10 caractères minimum' }) @MaxLength(128) newPassword!: string
}

export class BadgeDto {
  @IsIn(['QR', 'NFC']) kind!: 'QR' | 'NFC'
  @IsOptional() @IsString() @MaxLength(64) uid?: string
}
