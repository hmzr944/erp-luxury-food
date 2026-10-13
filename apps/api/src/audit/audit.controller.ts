import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AuditService } from './audit.service'

@Controller('organizations/me/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: { organizationId: string }, @Query('action') action?: string, @Query('before') before?: string) {
    return this.audit.list(user.organizationId, { action, before })
  }
}
