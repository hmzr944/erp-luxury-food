import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

export interface AuditEntry {
  organizationId: string | null
  userId?: string | null
  action: string
  target?: string | null
  detail?: string | null
  ip?: string | null
  terminalId?: string | null
}

// Trace les actions sensibles. Ne bloque jamais l'action : une écriture
// ratée est signalée dans les journaux du serveur.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          userId: entry.userId ?? null,
          action: entry.action,
          target: entry.target ?? null,
          detail: entry.detail?.slice(0, 500) ?? null,
          ip: entry.ip ?? null,
          terminalId: entry.terminalId ?? null,
        },
      })
    } catch (e) {
      this.logger.error(`Journal d'audit indisponible : ${entry.action}`, e instanceof Error ? e.stack : String(e))
    }
  }

  list(organizationId: string, params: { action?: string; before?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: { organizationId, ...(params.action ? { action: { startsWith: params.action } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(params.limit ?? 100, 200),
      ...(params.before ? { cursor: { id: params.before }, skip: 1 } : {}),
    })
  }
}
