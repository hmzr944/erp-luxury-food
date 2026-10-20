import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuthService } from '../auth/auth.service'
import { AuditService } from '../audit/audit.service'
import type { Role } from '@erp/types'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private audit: AuditService,
  ) {}

  findByOrganization(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true, email: true, firstName: true,
        lastName: true, role: true, createdAt: true, pinSetAt: true, badgeKind: true, badgeSetAt: true,
        sites: { select: { siteId: true } },
      },
      orderBy: { firstName: 'asc' },
    })
  }

  // Règles de l'équipe : seul le titulaire nomme ou touche un titulaire,
  // personne ne change son propre rôle
  private async target(actor: Actor, id: string, newRole?: Role) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true, role: true, email: true } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    if (actor.role !== 'OWNER' && (user.role === 'OWNER' || newRole === 'OWNER')) {
      throw new ForbiddenException('Réservé au titulaire du compte')
    }
    return user
  }

  async setPin(actor: Actor, id: string) {
    if (id !== actor.id) await this.target(actor, id)
    const r = await this.auth.setPin(id, actor.organizationId)
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.pin_set', target: id })
    return r
  }

  async clearPin(actor: Actor, id: string) {
    await this.target(actor, id)
    await this.auth.clearPin(id, actor.organizationId)
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.pin_cleared', target: id })
  }

  async setBadge(actor: Actor, id: string, dto: { kind: 'QR' | 'NFC'; uid?: string }) {
    await this.target(actor, id)
    const r = await this.auth.setBadge(id, actor.organizationId, dto)
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.badge_set', target: id, detail: dto.kind })
    return r
  }

  async clearBadge(actor: Actor, id: string) {
    await this.target(actor, id)
    await this.auth.clearBadge(id, actor.organizationId)
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.badge_cleared', target: id })
  }

  async findMe(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
    })
  }

  async create(actor: Actor, data: { email: string; password: string; firstName: string; lastName: string; role: Role; siteIds?: string[] }) {
    if (actor.role !== 'OWNER' && data.role === 'OWNER') throw new ForbiddenException('Réservé au titulaire du compte')
    const exists = await this.prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
    if (exists) throw new ConflictException('Un compte existe déjà avec cet e-mail')
    // Seulement des sites de l'organisation
    const siteIds = data.siteIds?.length
      ? (await this.prisma.site.findMany({ where: { id: { in: data.siteIds }, organizationId: actor.organizationId }, select: { id: true } })).map((s) => s.id)
      : []
    if (data.siteIds && siteIds.length !== new Set(data.siteIds).size) throw new ForbiddenException('Site inconnu')

    const passwordHash = await this.auth.hashPassword(data.password)
    const user = await this.prisma.user.create({
      data: {
        organizationId: actor.organizationId,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        ...(siteIds.length ? { sites: { create: siteIds.map((siteId) => ({ siteId })) } } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    })
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.created', target: user.id, detail: data.role })
    return user
  }

  async updateRole(actor: Actor, id: string, role: Role) {
    if (id === actor.id) throw new ForbiddenException('Vous ne pouvez pas changer votre propre rôle')
    const before = await this.target(actor, id, role)
    // Les sessions ouvertes repartent avec le nouveau rôle
    const user = await this.prisma.user.update({
      where: { id },
      data: { role, tokenVersion: { increment: 1 } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.role_changed', target: id, detail: `${before.role} → ${role}` })
    return user
  }

  // Remplace l'ensemble des boutiques d'un vendeur ou d'un membre de la production.
  // Le garde de site relit UserSite à chaque requête (le jeton ne porte aucun site) :
  // le retrait prend effet immédiatement, sans fermer la session.
  async setSites(actor: Actor, id: string, requested: string[]) {
    if (actor.role !== 'OWNER') throw new ForbiddenException('Réservé au titulaire du compte')
    const siteIds = [...new Set(requested)]
    if (!siteIds.length) throw new BadRequestException('Au moins une boutique')
    const user = await this.target(actor, id)
    if (user.role !== 'SELLER' && user.role !== 'PRODUCTION') {
      throw new BadRequestException('Ce rôle a accès à toutes les boutiques : rien à régler')
    }
    const known = await this.prisma.site.findMany({ where: { id: { in: siteIds }, organizationId: actor.organizationId }, select: { id: true } })
    if (known.length !== siteIds.length) throw new ForbiddenException('Site inconnu')

    const before = await this.prisma.$transaction(async (tx) => {
      const current = (await tx.userSite.findMany({ where: { userId: id }, select: { siteId: true } })).map((s) => s.siteId)
      await tx.userSite.deleteMany({ where: { userId: id, siteId: { notIn: siteIds } } })
      await tx.userSite.createMany({ data: siteIds.filter((s) => !current.includes(s)).map((siteId) => ({ userId: id, siteId })), skipDuplicates: true })
      return current
    })
    await this.audit.log({
      organizationId: actor.organizationId,
      userId: actor.id,
      action: 'user.sites_changed',
      target: id,
      detail: `avant : ${before.join(', ') || 'aucun'} ; après : ${siteIds.join(', ')}`,
    })
    return { id, siteIds }
  }

  async updateProfile(actor: Actor, data: { firstName?: string; lastName?: string; email?: string; currentPassword?: string }) {
    if (data.email) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { passwordHash: true, email: true } })
      if (data.email.toLowerCase() !== me.email) {
        const bcrypt = await import('bcrypt')
        if (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, me.passwordHash))) {
          throw new ForbiddenException("Mot de passe actuel requis pour changer d'e-mail")
        }
        const exists = await this.prisma.user.findFirst({ where: { email: data.email.toLowerCase(), NOT: { id: actor.id } } })
        if (exists) throw new ConflictException('E-mail déjà utilisé')
      }
    }
    return this.prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        ...(data.email ? { email: data.email.toLowerCase().trim() } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })
  }

  // Changer de mot de passe ferme les autres sessions ; celle-ci repart avec des jetons neufs
  async updatePassword(actor: Actor, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { passwordHash: true } })
    const bcrypt = await import('bcrypt')
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ForbiddenException('Mot de passe actuel incorrect')
    const passwordHash = await this.auth.hashPassword(newPassword)
    await this.prisma.user.update({ where: { id: actor.id }, data: { passwordHash, tokenVersion: { increment: 1 } } })
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.password_changed', target: actor.id })
    return { success: true, ...(await this.auth.sessionFor(actor.id)) }
  }

  async remove(actor: Actor, id: string) {
    if (id === actor.id) throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte')
    await this.target(actor, id)
    await this.prisma.user.delete({ where: { id } })
    await this.audit.log({ organizationId: actor.organizationId, userId: actor.id, action: 'user.removed', target: id })
    return { success: true }
  }
}

export interface Actor {
  id: string
  organizationId: string
  role: Role
}
