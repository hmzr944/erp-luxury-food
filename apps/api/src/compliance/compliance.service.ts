import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'
import type { SignedReceipt } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  // Appelé dans une Prisma.$transaction — jamais standalone
  async signReceipt(
    tx: Prisma.TransactionClient,
    siteId: string,
    serverTotal: Decimal,
    // Ticket déjà signé par la caisse : rattaché au maillon du site
    terminal?: {
      terminalId: string
      terminalCounter: number
      terminalHash: string
      terminalPreviousHash: string
      terminalSignature: string
      terminalSignedAt: Date
    },
  ): Promise<SignedReceipt> {
    // Verrou par site jusqu'à la fin de la transaction : les ventes simultanées
    // prennent leur numéro l'une après l'autre (compteur sans trou ni doublon)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'receipt:' + siteId}))`

    const last = await tx.receiptChain.findFirst({
      where: { siteId },
      orderBy: { counter: 'desc' },
      select: { counter: true, hash: true },
    })

    const counter = (last?.counter ?? 0) + 1
    const previousHash = last?.hash ?? '0'.repeat(64)
    const signedAt = new Date()

    const data = [
      previousHash,
      serverTotal.toString(),
      signedAt.toISOString(),
      counter.toString(),
    ].join('|')

    const hash = createHash('sha256').update(data).digest('hex')

    const receipt = await tx.receiptChain.create({
      data: { siteId, counter, hash, previousHash, total: serverTotal, signedAt, ...terminal },
    })

    return { id: receipt.id, counter, hash, previousHash, signedAt }
  }

  // Clôture journalière NF525 — génère le ticket Z
  async closeDay(siteId: string, closedBy?: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return this.prisma.$transaction(async (tx) => {
      // Vérifie qu'une clôture n'existe pas déjà pour ce jour
      const existing = await tx.dayClosure.findUnique({
        where: { siteId_date: { siteId, date: today } },
      })
      if (existing) throw new Error('Clôture journalière déjà effectuée pour cette date')

      // Agrège toutes les ventes du jour
      const agg = await tx.order.aggregate({
        where: { siteId, status: 'COMPLETED', createdAt: { gte: today, lt: tomorrow } },
        _count: true,
        _sum: { total: true },
      })

      // Récupère le dernier maillon NF525 de la journée
      const lastReceipt = await tx.receiptChain.findFirst({
        where: { siteId, signedAt: { gte: today, lt: tomorrow } },
        orderBy: { counter: 'desc' },
        select: { counter: true, hash: true },
      })

      const totalAmount = agg._sum.total ?? 0
      const lastCounter = lastReceipt?.counter ?? 0

      // Hash de clôture: SHA-256(siteId|date|totalOrders|totalAmount|lastCounter)
      const closureData = [
        siteId,
        today.toISOString(),
        String(agg._count),
        totalAmount.toString(),
        String(lastCounter),
      ].join('|')
      const hash = createHash('sha256').update(closureData).digest('hex')

      return tx.dayClosure.create({
        data: {
          siteId,
          date: today,
          totalOrders: agg._count,
          totalAmount,
          lastCounter,
          hash,
          closedBy,
        },
      })
    })
  }

  // Récupère les clôtures d'un site
  getClosures(siteId: string, limit = 30) {
    return this.prisma.dayClosure.findMany({
      where: { siteId },
      orderBy: { date: 'desc' },
      take: limit,
    })
  }

  // Vérifie l'intégrité de la chaîne NF525 pour un jour donné
  async verifyDayChain(siteId: string, date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const receipts = await this.prisma.receiptChain.findMany({
      where: { siteId, signedAt: { gte: start, lt: end } },
      orderBy: { counter: 'asc' },
    })

    if (receipts.length === 0) return { valid: true, checked: 0, errors: [] }

    const errors: string[] = []

    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i]

      // Vérifie le compteur séquentiel
      if (i > 0 && r.counter !== receipts[i - 1].counter + 1) {
        errors.push(`Gap dans les counters : ${receipts[i - 1].counter} → ${r.counter}`)
      }

      // Vérifie le lien previousHash
      if (i > 0 && r.previousHash !== receipts[i - 1].hash) {
        errors.push(`Chaîne rompue au counter ${r.counter}`)
      }

      // Recalcule le hash
      const data = [r.previousHash, r.total.toString(), r.signedAt.toISOString(), r.counter.toString()].join('|')
      const expected = createHash('sha256').update(data).digest('hex')
      if (expected !== r.hash) {
        errors.push(`Hash incorrect au counter ${r.counter}`)
      }
    }

    return {
      valid: errors.length === 0,
      checked: receipts.length,
      firstCounter: receipts[0].counter,
      lastCounter: receipts[receipts.length - 1].counter,
      errors,
    }
  }
}
