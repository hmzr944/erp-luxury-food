import { ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../common/prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { PIN_RE, PinAttempts, pinLookup } from './pin'

export const MANAGER_ROLES = ['OWNER', 'MANAGER'] as const
export const isManagerRole = (role?: string | null): boolean => !!role && (MANAGER_ROLES as readonly string[]).includes(role)

export type Requester = { id: string; organizationId: string; role?: string; email?: string }
export type Authorizer = { id: string; name: string; role: string }

// Autorisation d'un responsable pour une action sensible faite par un vendeur
// (remboursement). Le responsable (OWNER ou MANAGER de l'organisation) saisit
// son code à 4 chiffres ; le serveur le vérifie comme à l'ouverture de la
// caisse : empreinte HMAC, essais limités par demandeur puis par organisation.
// Aucun code n'est conservé et rien de nouveau n'est stocké en base.
// Compteurs en mémoire du processus, comme PinAttempts (une seule instance d'API).
@Injectable()
export class ManagerAuthorization {
  private byRequester = new PinAttempts()
  private byOrg = new PinAttempts(30, 15 * 60_000)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private get pinSecret() {
    return this.config.get<string>('PIN_SECRET') ?? this.config.getOrThrow<string>('JWT_SECRET')
  }

  // null : le demandeur est lui-même responsable, rien à saisir.
  // Sinon : le responsable qui a donné son code, ou une 403 en français.
  async authorize(requester: Requester, pin: string | undefined, action: string, target?: string): Promise<Authorizer | null> {
    if (isManagerRole(requester.role)) return null

    const refuse = async (reason: string, message: string): Promise<never> => {
      await this.audit.log({
        organizationId: requester.organizationId,
        userId: requester.id,
        action: 'manager.authorization_refused',
        target,
        detail: `${action} : ${reason}`,
      })
      throw new ForbiddenException(message)
    }

    const locked = this.byRequester.lockedFor(requester.id) || this.byOrg.lockedFor(requester.organizationId)
    if (locked) return refuse('trop d\'essais', `Trop d'essais : autorisation bloquée ${locked} min`)
    if (!pin) return refuse('code absent', "Cette action demande l'autorisation d'un responsable : saisissez son code")

    const manager = PIN_RE.test(pin)
      ? await this.prisma.user.findUnique({
          where: { organizationId_pinLookup: { organizationId: requester.organizationId, pinLookup: pinLookup(this.pinSecret, requester.organizationId, pin) } },
          select: { id: true, firstName: true, lastName: true, role: true },
        })
      : null
    // Le code d'un vendeur n'autorise rien, pas plus que celui du demandeur
    if (!manager || !isManagerRole(manager.role) || manager.id === requester.id) {
      this.byRequester.fail(requester.id)
      this.byOrg.fail(requester.organizationId)
      return refuse(manager ? `code d'un compte sans droit (${manager.role})` : 'code inconnu', "Code du responsable incorrect, ou compte sans droit d'autoriser")
    }
    this.byRequester.succeed(requester.id)
    return { id: manager.id, name: `${manager.firstName} ${manager.lastName}`.trim(), role: manager.role }
  }
}
