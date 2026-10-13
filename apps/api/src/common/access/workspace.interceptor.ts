import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { isAllowed } from './workspace-policy'

const MESSAGE: Record<string, string> = {
  PRODUCTION: "Réservé à la boutique ou au gérant : l'espace atelier ne voit que la production",
  SELLER: 'Réservé au gérant',
}

// Les intercepteurs passent après les gardes : l'utilisateur est authentifié
@Injectable()
export class WorkspaceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()
    const req = context.switchToHttp().getRequest<{ method: string; originalUrl: string; user?: { role?: string } }>()
    const role = req.user?.role
    if (role && !isAllowed(role, req.method, req.originalUrl)) throw new ForbiddenException(MESSAGE[role] ?? 'Accès refusé')
    return next.handle()
  }
}
