import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ORG_SCOPED_SITE } from '../decorators/org-scoped-site.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { Role } from '@erp/types'

@Injectable()
export class SiteGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    @Optional() private reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const siteId: string | undefined =
      request.params?.siteId ?? request.body?.siteId ?? request.query?.siteId

    if (!siteId) return true

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    })

    if (!site) throw new NotFoundException('Site introuvable')

    // Double vérification : même organisation (protection IDOR cross-tenant)
    if (site.organizationId !== user.organizationId) {
      throw new ForbiddenException('Accès refusé')
    }

    // OWNER et MANAGER ont accès à tous les sites de leur org
    if (user.role === Role.OWNER || user.role === Role.MANAGER) return true

    // Synchronisation d'une vente déjà signée : l'organisation suffit
    if (this.reflector?.getAllAndOverride<boolean>(ORG_SCOPED_SITE, [context.getHandler(), context.getClass()])) return true

    // SELLER : doit être explicitement rattaché au site
    const userSite = await this.prisma.userSite.findUnique({
      where: { userId_siteId: { userId: user.id, siteId } },
    })

    if (!userSite) throw new ForbiddenException('Accès refusé à ce site')

    return true
  }
}
