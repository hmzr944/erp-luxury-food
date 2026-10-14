import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { OrganizationsService } from './organizations.service'
import { Role } from '@erp/types'
import { BadRequestException } from '@nestjs/common'
import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Matches, MaxLength, Min, IsIn } from 'class-validator'
import { assertPublicUrl, UnsafeUrlError } from '../common/net/public-url'

class SettingsDto {
  @IsOptional() @Matches(/^\d{14}$/, { message: 'SIRET : 14 chiffres' }) siret?: string
  @IsOptional() @Matches(/^[A-Z]{2}[0-9A-Z]{2,13}$/, { message: 'Numéro de TVA invalide' }) vatNumber?: string
  @IsOptional() @IsString() @MaxLength(40) legalForm?: string
  @IsOptional() @IsNumber() @Min(0) capital?: number
  @IsOptional() @IsString() @MaxLength(120) rcs?: string
  @IsOptional() @IsString() @MaxLength(200) legalAddress?: string
  @IsOptional() @IsString() @MaxLength(100) legalCity?: string
  @IsOptional() @IsString() @MaxLength(12) legalZipCode?: string
  @IsOptional() @IsString() @MaxLength(80) pdpName?: string
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(300) pdpEndpoint?: string
  @IsOptional() @IsString() @MaxLength(500) pdpApiKey?: string
  @IsOptional() @IsBoolean() pdpEnabled?: boolean
  // Ticket : sur demande du client (loi AGEC), toujours ou jamais
  @IsOptional() @IsIn(['ASK', 'ALWAYS', 'NEVER']) receiptPolicy?: string
  // Note de service à partir de 25 € TTC (restauration, prestations)
  @IsOptional() @IsBoolean() serviceNote?: boolean
  @IsOptional() @IsString() @MaxLength(300) receiptFooter?: string
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get('me')
  getCurrent(@CurrentUser() user: { organizationId: string }) {
    return this.orgs.findById(user.organizationId)
  }

  @Get('me/settings')
  getSettings(@CurrentUser() user: { organizationId: string }) {
    return this.orgs.getSettings(user.organizationId)
  }

  @Put('me/settings')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  async upsertSettings(
    @CurrentUser() user: { organizationId: string },
    @Body() data: SettingsDto,
  ) {
    if (data.pdpEndpoint) {
      await assertPublicUrl(data.pdpEndpoint).catch((e) => {
        throw e instanceof UnsafeUrlError ? new BadRequestException(e.message) : e
      })
    }
    return this.orgs.upsertSettings(user.organizationId, data)
  }
}
