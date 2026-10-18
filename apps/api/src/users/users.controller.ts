import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RequireSubscription } from '../common/decorators/require-subscription.decorator'
import { UsersService, type Actor } from './users.service'
import { Role } from '@erp/types'
import { BadgeDto, CreateUserDto, UpdatePasswordDto, UpdateProfileDto, UpdateRoleDto } from './users.dto'

@Controller('users')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: Actor) {
    return this.users.findByOrganization(user.organizationId)
  }

  @Get('me')
  getMe(@CurrentUser() user: Actor) {
    return this.users.findMe(user.id)
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: Actor, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto)
  }

  @Patch('me/password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updatePassword(@CurrentUser() user: Actor, @Body() dto: UpdatePasswordDto) {
    return this.users.updatePassword(user, dto.currentPassword, dto.newPassword)
  }

  // Code vendeur tiré au hasard par le serveur (jamais choisi : on ne peut
  // pas sonder les codes des collègues)
  @Put('me/pin')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  setMyPin(@CurrentUser() user: Actor) {
    return this.users.setPin(user, user.id)
  }

  @Put(':id/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  setPin(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.users.setPin(user, id)
  }

  @Delete(':id/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  clearPin(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.users.clearPin(user, id)
  }

  // Badge : carte QR (jeton neuf) ou badge NFC (identifiant lu)
  @Put(':id/badge')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  setBadge(@CurrentUser() user: Actor, @Param('id') id: string, @Body() dto: BadgeDto) {
    return this.users.setBadge(user, id, dto)
  }

  @Delete(':id/badge')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  clearBadge(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.users.clearBadge(user, id)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @RequireSubscription()
  create(@CurrentUser() user: Actor, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto)
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  updateRole(@CurrentUser() user: Actor, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.users.updateRole(user, id, dto.role)
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: Actor, @Param('id') id: string) {
    return this.users.remove(user, id)
  }
}
