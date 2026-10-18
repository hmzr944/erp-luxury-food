import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { accessState, billingEnabled } from '../../billing/access-state'

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Votre essai est terminé : abonnez-vous pour ajouter ou modifier des articles, des boutiques, des caisses ou des membres. Vos ventes, clôtures et exports restent accessibles."

// Écritures qui supposent un usage continu (catalogue, boutiques, caisses,
// membres) : refusées une fois le compte verrouillé. Jamais posé sur les
// ventes, la synchronisation, les clôtures, les exports, la conformité,
// l'authentification ni la facturation : voir RequireSubscription
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest()
    // Sans compte, c'est à l'authentification de répondre
    if (!user?.organizationId) return true
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
    })
    if (!org) return true
    const { state } = accessState(org, new Date(), { billingEnabled: billingEnabled(this.config) })
    if (state === 'locked') {
      throw new HttpException({ message: SUBSCRIPTION_REQUIRED_MESSAGE, code: 'SUBSCRIPTION_REQUIRED' }, HttpStatus.PAYMENT_REQUIRED)
    }
    return true
  }
}
