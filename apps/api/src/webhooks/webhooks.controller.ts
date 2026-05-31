import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { WebhooksService } from './webhooks.service'

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Get()
  findAll(@CurrentUser() user: { organizationId: string }) {
    return this.webhooks.findByOrganization(user.organizationId)
  }

  @Get('events')
  getEvents() {
    return this.webhooks.getEvents()
  }

  @Post()
  create(
    @CurrentUser() user: { organizationId: string },
    @Body() dto: { url: string; events: string[] },
  ) {
    return this.webhooks.create(user.organizationId, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: { url?: string; events?: string[]; isActive?: boolean },
  ) {
    return this.webhooks.update(id, user.organizationId, dto)
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.webhooks.testWebhook(id, user.organizationId)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.webhooks.remove(id, user.organizationId)
  }
}
