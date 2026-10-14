import { createHash } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { FISCAL_EVENTS, type FiscalEventCode } from '@erp/types'
import { RECEIPT_GENESIS_HASH, eventInput, stableStringify } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'

export interface FiscalEventInput {
  organizationId: string | null
  siteId?: string | null
  code: FiscalEventCode
  detail?: Record<string, unknown>
  userId?: string | null
  terminalId?: string | null
}

type Db = Prisma.TransactionClient | PrismaService

// Journal des événements techniques : chaque événement est numéroté par
// organisation et chaîné au précédent (empreinte SHA-256). Ajout seul.
@Injectable()
export class FiscalEventsService {
  private readonly logger = new Logger(FiscalEventsService.name)

  constructor(private prisma: PrismaService) {}

  // Dans une transaction existante (même verrou que l'opération tracée)
  async record(tx: Prisma.TransactionClient, e: FiscalEventInput) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'fiscal-event:' + (e.organizationId ?? 'system')}))`
    const last = await tx.fiscalEvent.findFirst({
      where: { organizationId: e.organizationId },
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true },
    })
    const seq = (last?.seq ?? 0) + 1
    const previousHash = last?.hash ?? RECEIPT_GENESIS_HASH
    const createdAt = new Date()
    const detail = e.detail ? stableStringify(e.detail) : ''
    const hash = createHash('sha256')
      .update(eventInput({ previousHash, seq, code: e.code, siteId: e.siteId, userId: e.userId, terminalId: e.terminalId, detail, createdAt: createdAt.toISOString() }))
      .digest('hex')
    return tx.fiscalEvent.create({
      data: {
        organizationId: e.organizationId,
        siteId: e.siteId ?? null,
        seq,
        code: e.code,
        label: FISCAL_EVENTS[e.code],
        detail: (e.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        userId: e.userId ?? null,
        terminalId: e.terminalId ?? null,
        previousHash,
        hash,
        createdAt,
      },
    })
  }

  // Hors transaction : ouvre la sienne. Une trace manquante ne doit jamais
  // bloquer la caisse, mais elle est signalée dans les journaux du serveur.
  async log(e: FiscalEventInput) {
    try {
      return await this.prisma.$transaction((tx) => this.record(tx, e))
    } catch (err) {
      this.logger.error(`Événement ${e.code} non journalisé : ${(err as Error).message}`)
      return null
    }
  }

  list(db: Db, where: { organizationId: string; siteId?: string }, take = 100) {
    return db.fiscalEvent.findMany({
      where: { organizationId: where.organizationId, ...(where.siteId ? { OR: [{ siteId: where.siteId }, { siteId: null }] } : {}) },
      orderBy: { seq: 'desc' },
      take,
    })
  }

  // Revérifie la chaîne du journal d'une organisation
  async verify(organizationId: string | null) {
    const events = await this.prisma.fiscalEvent.findMany({ where: { organizationId }, orderBy: { seq: 'asc' } })
    const errors: string[] = []
    let previous = RECEIPT_GENESIS_HASH
    events.forEach((ev, i) => {
      if (ev.seq !== i + 1) errors.push(`Événement n° ${i + 1} manquant`)
      if (ev.previousHash !== previous) errors.push(`Chaîne du journal rompue à l’événement n° ${ev.seq}`)
      const detail = ev.detail == null ? '' : stableStringify(ev.detail)
      const expected = createHash('sha256')
        .update(eventInput({ previousHash: ev.previousHash, seq: ev.seq, code: ev.code, siteId: ev.siteId, userId: ev.userId, terminalId: ev.terminalId, detail, createdAt: ev.createdAt.toISOString() }))
        .digest('hex')
      if (expected !== ev.hash) errors.push(`Empreinte incorrecte à l’événement n° ${ev.seq}`)
      previous = ev.hash
    })
    return { valid: errors.length === 0, checked: events.length, errors }
  }
}
