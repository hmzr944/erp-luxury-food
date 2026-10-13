import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '@erp/types'
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { B2BClientsService } from './b2b-clients.service'
import { CreateB2BClientBody, UpdateB2BClientBody } from './b2b.dto'

@Controller('b2b/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
export class B2BClientsController {
  constructor(private clients: B2BClientsService) {}

  @Get()
  findAll(@CurrentUser() user: { organizationId: string }) {
    return this.clients.findAll(user.organizationId)
  }

  @Get(':id')
  findById(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.clients.findById(id, user.organizationId)
  }

  @Get(':id/stats')
  getStats(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.clients.getStats(id, user.organizationId)
  }

  @Post()
  create(
    @CurrentUser() user: { organizationId: string },
    @Body() dto: CreateB2BClientBody,
  ) {
    return this.clients.create(user.organizationId, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: UpdateB2BClientBody,
  ) {
    return this.clients.update(id, user.organizationId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.clients.remove(id, user.organizationId)
  }
}
