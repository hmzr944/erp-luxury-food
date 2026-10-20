import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { SiteGuard } from '../common/guards/site.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { InventoryService } from './inventory.service'
import { CountLineDto, StartInventoryDto } from './inventory.dto'

type Actor = { id: string; organizationId: string }

// Lecture pour tous les rôles du site ; démarrer, compter, valider et
// annuler : titulaire et gérant
@Controller('sites/:siteId/inventories')
@UseGuards(JwtAuthGuard, SiteGuard)
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get()
  list(@Param('siteId') siteId: string) {
    return this.inventory.list(siteId)
  }

  @Get('current')
  current(@Param('siteId') siteId: string) {
    return this.inventory.current(siteId)
  }

  @Get(':id')
  get(@Param('siteId') siteId: string, @Param('id') id: string) {
    return this.inventory.get(siteId, id)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  start(@Param('siteId') siteId: string, @Body() dto: StartInventoryDto, @CurrentUser() user: Actor) {
    return this.inventory.start(siteId, dto, user.id)
  }

  @Patch(':id/lines/:lineId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  countLine(
    @Param('siteId') siteId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: CountLineDto,
  ) {
    return this.inventory.countLine(siteId, id, lineId, dto)
  }

  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  validate(@Param('siteId') siteId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.inventory.validate(siteId, id, { userId: user.id, organizationId: user.organizationId })
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  cancel(@Param('siteId') siteId: string, @Param('id') id: string, @CurrentUser() user: Actor) {
    return this.inventory.cancel(siteId, id, { userId: user.id, organizationId: user.organizationId })
  }
}
