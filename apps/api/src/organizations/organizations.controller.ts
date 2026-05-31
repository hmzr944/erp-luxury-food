import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { OrganizationsService } from './organizations.service'
import { Role } from '@erp/types'

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
  upsertSettings(
    @CurrentUser() user: { organizationId: string },
    @Body() data: any,
  ) {
    return this.orgs.upsertSettings(user.organizationId, data)
  }
}
