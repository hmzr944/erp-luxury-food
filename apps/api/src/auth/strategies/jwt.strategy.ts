import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma/prisma.service'

interface JwtPayload {
  sub: string
  email: string
  role: string
  organizationId: string
  tv?: number
}

// État du compte relu en base (10 s de cache) : un compte supprimé, un rôle
// changé ou une déconnexion « partout » prennent effet sans attendre
// l'expiration du jeton
const CACHE_MS = 10_000
const cache = new Map<string, { at: number; role: string; organizationId: string; tokenVersion: number } | null>()

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
      algorithms: ['HS256'],
    })
  }

  async validate(payload: JwtPayload) {
    let state = cache.get(payload.sub)
    if (state === undefined || (state && Date.now() - state.at > CACHE_MS)) {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, organizationId: true, tokenVersion: true },
      })
      state = user ? { at: Date.now(), ...user } : null
      cache.set(payload.sub, state)
      if (!user) setTimeout(() => cache.delete(payload.sub), CACHE_MS)
    }
    if (!state || state.tokenVersion !== (payload.tv ?? 0) || state.organizationId !== payload.organizationId) {
      throw new UnauthorizedException('Session expirée')
    }
    return { id: payload.sub, email: payload.email, role: state.role, organizationId: state.organizationId }
  }
}
