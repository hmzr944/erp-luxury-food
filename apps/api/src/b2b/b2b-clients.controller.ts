import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { B2BClientsService, type CreateB2BClientDto } from './b2b-clients.service'

@Controller('b2b/clients')
@UseGuards(JwtAuthGuard)
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
    @Body() dto: CreateB2BClientDto,
  ) {
    return this.clients.create(user.organizationId, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: Partial<CreateB2BClientDto>,
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
