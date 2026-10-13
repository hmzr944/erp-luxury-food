import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../prisma/prisma.service'
import { PACK_KEY } from '../decorators/require-pack.decorator'
import type { Pack } from '@erp/types'

// Bloque les routes d'un pack métier que l'organisation n'a pas activé
@Injectable()
export class PackGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const pack = this.reflector.getAllAndOverride<Pack | undefined>(PACK_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!pack) return true

    const { user } = context.switchToHttp().getRequest()
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { packs: true },
    })
    if (!org?.packs.includes(pack)) {
      throw new ForbiddenException(`Le pack ${pack} n'est pas activé pour cette organisation`)
    }
    return true
  }
}
