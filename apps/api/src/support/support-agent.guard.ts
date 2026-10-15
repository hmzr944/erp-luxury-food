import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { SupportService } from './support.service'

// Équipe FLŌW : compte authentifié dont l'e-mail figure dans
// SUPPORT_AGENT_EMAILS. L'e-mail est relu en base, pas pris dans le jeton.
@Injectable()
export class SupportAgentGuard implements CanActivate {
  constructor(private support: SupportService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>()
    if (req.user?.id && (await this.support.isAgent(req.user.id))) return true
    throw new ForbiddenException('Accès réservé à l’équipe FLŌW')
  }
}
