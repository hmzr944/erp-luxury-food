import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ApiTokensService } from './api-tokens.service'

@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private tokens: ApiTokensService) {}

  @Get()
  findAll(@CurrentUser() user: { organizationId: string }) {
    return this.tokens.findByOrganization(user.organizationId)
  }

  @Get('scopes')
  getScopes() {
    return this.tokens.getScopes()
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; organizationId: string },
    @Body() dto: { name: string; scopes: string[]; expiresAt?: string },
  ) {
    return this.tokens.create({
      userId: user.id,
      organizationId: user.organizationId,
      name: dto.name,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  revoke(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
  ) {
    return this.tokens.revoke(id, user.organizationId)
  }
}
