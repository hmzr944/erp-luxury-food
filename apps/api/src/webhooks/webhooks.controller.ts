import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { Role } from '@erp/types'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'

class CreateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) url!: string
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) events!: string[]
}

class UpdateWebhookDto {
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) url?: string
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) events?: string[]
  @IsOptional() @IsBoolean() isActive?: boolean
}
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { WebhooksService } from './webhooks.service'

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.MANAGER)
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
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooks.create(user.organizationId, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
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
