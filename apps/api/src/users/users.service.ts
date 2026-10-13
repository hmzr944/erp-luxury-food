import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuthService } from '../auth/auth.service'
import type { Role } from '@erp/types'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true, email: true, firstName: true,
        lastName: true, role: true, createdAt: true, pinSetAt: true,
        sites: { select: { siteId: true } },
      },
      orderBy: { firstName: 'asc' },
    })
  }

  setPin(id: string, organizationId: string, pin?: string) {
    return this.auth.setPin(id, organizationId, pin)
  }

  clearPin(id: string, organizationId: string) {
    return this.auth.clearPin(id, organizationId)
  }

  async findMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
    })
  }

  async create(data: {
    organizationId: string
    email: string
    password: string
    firstName: string
    lastName: string
    role: Role
    siteIds?: string[]
  }) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
    if (exists) throw new ConflictException('Un compte existe déjà avec cet email')

    const passwordHash = await this.auth.hashPassword(data.password)
    const user = await this.prisma.user.create({
      data: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        ...(data.siteIds?.length
          ? { sites: { create: data.siteIds.map((siteId) => ({ siteId })) } }
          : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    })
    return user
  }

  async updateRole(id: string, organizationId: string, role: Role) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })
  }

  async updateProfile(id: string, data: { firstName?: string; lastName?: string; email?: string }) {
    if (data.email) {
      const exists = await this.prisma.user.findFirst({
        where: { email: data.email.toLowerCase(), NOT: { id } },
      })
      if (exists) throw new ConflictException('Email déjà utilisé')
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName ? { firstName: data.firstName } : {}),
        ...(data.lastName ? { lastName: data.lastName } : {}),
        ...(data.email ? { email: data.email.toLowerCase() } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })
  }

  async updatePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { passwordHash: true },
    })
    const bcrypt = await import('bcrypt')
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new ForbiddenException('Mot de passe actuel incorrect')

    const passwordHash = await this.auth.hashPassword(newPassword)
    await this.prisma.user.update({ where: { id }, data: { passwordHash } })
    return { success: true }
  }

  async remove(id: string, organizationId: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte')
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    await this.prisma.user.delete({ where: { id } })
    return { success: true }
  }
}
