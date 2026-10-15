import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { SupportService, type SupportUser } from './support.service'
import { SupportAgentGuard } from './support-agent.guard'
import { AgentReplyDto, AgentStatusDto, CreateThreadDto, PostMessageDto } from './support.dto'

// Commerçant : tous les rôles, limité aux demandes de son organisation
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private support: SupportService) {}

  @Get('status')
  status(@CurrentUser() user: SupportUser) {
    return this.support.status(user)
  }

  @Get('unread')
  unread(@CurrentUser() user: SupportUser) {
    return this.support.unread(user.organizationId)
  }

  @Get('threads')
  list(@CurrentUser() user: SupportUser) {
    return this.support.list(user.organizationId)
  }

  @Post('threads')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: SupportUser, @Body() dto: CreateThreadDto) {
    return this.support.create(user, dto)
  }

  @Get('threads/:id')
  get(@CurrentUser() user: SupportUser, @Param('id') id: string) {
    return this.support.get(user.organizationId, id)
  }

  @Post('threads/:id/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  post(@CurrentUser() user: SupportUser, @Param('id') id: string, @Body() dto: PostMessageDto) {
    return this.support.post(user, id, dto.body)
  }

  @Post('threads/:id/read')
  @HttpCode(200)
  read(@CurrentUser() user: SupportUser, @Param('id') id: string) {
    return this.support.markRead(user.organizationId, id)
  }
}

// Équipe FLŌW : toutes les organisations, réservé à SUPPORT_AGENT_EMAILS
@Controller('support/agent')
@UseGuards(JwtAuthGuard, SupportAgentGuard)
export class SupportAgentController {
  constructor(private support: SupportService) {}

  @Get('threads')
  list(@Query('filter') filter?: string) {
    const f = filter === 'all' || filter === 'RESOLVED' ? filter : 'active'
    return this.support.agentList(f)
  }

  @Get('threads/:id')
  get(@Param('id') id: string) {
    return this.support.agentGet(id)
  }

  @Post('threads/:id/messages')
  reply(@CurrentUser() user: SupportUser, @Param('id') id: string, @Body() dto: AgentReplyDto) {
    return this.support.agentReply(user, id, dto)
  }

  @Patch('threads/:id')
  setStatus(@CurrentUser() user: SupportUser, @Param('id') id: string, @Body() dto: AgentStatusDto) {
    return this.support.agentStatus(user, id, dto.status)
  }
}
