import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { SitesService } from './sites.service'
import { Role } from '@erp/types'

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private sites: SitesService) {}

  @Get()
  findAll(@CurrentUser() user: { organizationId: string }) {
    return this.sites.findByOrganization(user.organizationId)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER)
  create(
    @CurrentUser() user: { organizationId: string },
    @Body() dto: { name: string; address?: string; timezone?: string },
  ) {
    return this.sites.create(user.organizationId, dto)
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: { name?: string; address?: string; timezone?: string },
  ) {
    return this.sites.update(id, user.organizationId, dto)
  }

  @Get(':id/printers')
  getPrinters(@Param('id') siteId: string) {
    return this.sites.getPrinters(siteId)
  }

  @Post(':id/printers/test')
  testPrint(@Param('id') siteId: string, @Body('printerId') printerId: number) {
    return this.sites.testPrint(siteId, printerId)
  }
}
