import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireSubscription } from '../common/decorators/require-subscription.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { SitesService } from './sites.service'
import { Role } from '@erp/types'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

class SiteDto {
  @IsString() @MaxLength(120) name!: string
  @IsOptional() @IsString() @MaxLength(300) address?: string
  @IsOptional() @IsString() @MaxLength(60) timezone?: string
}
class UpdateSiteDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(300) address?: string
  @IsOptional() @IsString() @MaxLength(60) timezone?: string
}
class PrintTestDto {
  @IsInt() @Min(1) printerId!: number
}

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private sites: SitesService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string; organizationId: string; role: Role }) {
    // Vendeur et atelier ne voient que les sites qui leur sont attribués
    const restricted = user.role === Role.SELLER || user.role === Role.PRODUCTION
    return this.sites.findByOrganization(user.organizationId, restricted ? user.id : undefined)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  @RequireSubscription()
  create(
    @CurrentUser() user: { organizationId: string },
    @Body() dto: SiteDto,
  ) {
    return this.sites.create(user.organizationId, dto)
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sites.update(id, user.organizationId, dto)
  }

  // Imprimantes : gérant uniquement, et seulement pour un site de son organisation
  @Get(':id/printers')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async getPrinters(@CurrentUser() user: { organizationId: string }, @Param('id') siteId: string) {
    await this.sites.assertInOrganization(siteId, user.organizationId)
    return this.sites.getPrinters(siteId)
  }

  @Post(':id/printers/test')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  async testPrint(@CurrentUser() user: { organizationId: string }, @Param('id') siteId: string, @Body() dto: PrintTestDto) {
    await this.sites.assertInOrganization(siteId, user.organizationId)
    return this.sites.testPrint(siteId, dto.printerId)
  }
}
