import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { UsersService } from './users.service'
import { Role } from '@erp/types'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: { organizationId: string }) {
    return this.users.findByOrganization(user.organizationId)
  }

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.users.findMe(user.id)
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: { firstName?: string; lastName?: string; email?: string },
  ) {
    return this.users.updateProfile(user.id, dto)
  }

  @Patch('me/password')
  updatePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.users.updatePassword(user.id, dto.currentPassword, dto.newPassword)
  }

  // Code vendeur : le sien, ou celui d'un membre de l'équipe pour un gérant
  @Put('me/pin')
  setMyPin(@CurrentUser() user: { id: string; organizationId: string }, @Body('pin') pin?: string) {
    return this.users.setPin(user.id, user.organizationId, pin)
  }

  @Put(':id/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  setPin(@CurrentUser() user: { organizationId: string }, @Param('id') id: string, @Body('pin') pin?: string) {
    return this.users.setPin(id, user.organizationId, pin)
  }

  @Delete(':id/pin')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  clearPin(@CurrentUser() user: { organizationId: string }, @Param('id') id: string) {
    return this.users.clearPin(id, user.organizationId)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  create(
    @CurrentUser() user: { organizationId: string },
    @Body() dto: {
      email: string; firstName: string; lastName: string
      role: Role; password: string; siteIds?: string[]
    },
  ) {
    return this.users.create({ ...dto, organizationId: user.organizationId })
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  updateRole(
    @CurrentUser() user: { organizationId: string },
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.users.updateRole(id, user.organizationId, role)
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id') id: string,
  ) {
    return this.users.remove(id, user.organizationId, user.id)
  }
}
