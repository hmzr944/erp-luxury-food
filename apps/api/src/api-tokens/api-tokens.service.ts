import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'

const ALL_SCOPES = [
  'orders:read', 'orders:write',
  'products:read', 'products:write',
  'stock:read', 'stock:write',
  'allergens:read',
  'dashboard:read',
]

@Injectable()
export class ApiTokensService {
  constructor(private prisma: PrismaService) {}

  findByOrganization(organizationId: string) {
    return this.prisma.apiToken.findMany({
      where: { organizationId, isRevoked: false },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Crée un nouveau token — retourne le token en clair UNE SEULE FOIS
  async create(data: {
    userId: string
    organizationId: string
    name: string
    scopes: string[]
    expiresAt?: Date
  }): Promise<{ token: string; record: any }> {
    const raw = `erp_live_${randomBytes(24).toString('hex')}`
    const tokenHash = createHash('sha256').update(raw).digest('hex')
    const prefix = raw.substring(0, 12)

    const record = await this.prisma.apiToken.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        name: data.name,
        tokenHash,
        prefix,
        scopes: data.scopes.filter((s) => ALL_SCOPES.includes(s)),
        expiresAt: data.expiresAt,
      },
      select: {
        id: true, name: true, prefix: true, scopes: true, createdAt: true, expiresAt: true,
      },
    })

    return { token: raw, record }
  }

  async revoke(id: string, organizationId: string) {
    const token = await this.prisma.apiToken.findFirst({ where: { id, organizationId } })
    if (!token) throw new NotFoundException('Token introuvable')
    await this.prisma.apiToken.update({ where: { id }, data: { isRevoked: true } })
    return { success: true }
  }

  // Valide un token entrant (utilisé par la stratégie API)
  async validateToken(raw: string): Promise<{ userId: string; organizationId: string; scopes: string[] } | null> {
    const tokenHash = createHash('sha256').update(raw).digest('hex')
    const token = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, organizationId: true, scopes: true, isRevoked: true, expiresAt: true },
    })

    if (!token || token.isRevoked) return null
    if (token.expiresAt && token.expiresAt < new Date()) return null

    // Met à jour lastUsedAt en arrière-plan
    this.prisma.apiToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {})

    return { userId: token.userId, organizationId: token.organizationId, scopes: token.scopes }
  }

  getScopes() {
    return ALL_SCOPES
  }
}
