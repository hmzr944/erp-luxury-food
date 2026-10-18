import { webcrypto } from 'node:crypto'
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireSubscription } from '../common/decorators/require-subscription.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { TerminalsService } from './terminals.service'

class RegisterTerminalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string

  @IsObject()
  publicKey!: webcrypto.JsonWebKey
}

@Controller('sites/:siteId/terminals')
@UseGuards(JwtAuthGuard, SiteGuard, RolesGuard)
export class TerminalsController {
  constructor(private terminals: TerminalsService) {}

  // Appelé par la caisse à sa première ouverture sur cet appareil. Installer
  // une caisse est réservé au gérant : une caisse peut ouvrir des sessions
  // par code ou badge
  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  @RequireSubscription()
  register(
    @Param('siteId') siteId: string,
    @Body() dto: RegisterTerminalDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.terminals.register(siteId, dto, user.id)
  }

  @Get()
  findAll(@Param('siteId') siteId: string) {
    return this.terminals.findBySite(siteId)
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  deactivate(@Param('siteId') siteId: string, @Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.terminals.deactivate(siteId, id, user.id)
  }

  @Get(':id/verify')
  @Roles(Role.OWNER, Role.MANAGER)
  verify(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.terminals.verifyChain(siteId, id)
  }
}
