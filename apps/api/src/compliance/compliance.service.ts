import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import type { OrderKind, Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { SignedReceipt } from '@erp/types'
import { RECEIPT_GENESIS_HASH, ledgerEntryInput, ledgerEntryInputV1 } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { checkSaleDigest } from './sale-content'

export interface TerminalSeal {
  terminalId: string
  terminalCounter: number
  terminalHash: string
  terminalPreviousHash: string
  terminalSignature: string
  terminalSignedAt: Date
}

export interface SignReceiptInput {
  total: Decimal
  kind: OrderKind
  // Représentation canonique du contenu (lignes, paiements) : son empreinte
  // entre dans le maillon, toute modification ultérieure se verrait
  content: string
  terminal?: TerminalSeal
}

// Ventes lues par paquet pendant la vérification du grand livre
const SALES_CHUNK = 500

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// Grand livre fiscal (art. 286 I 3° bis CGI) : chaque ticket du site est un
// maillon numéroté sans trou, chaîné au précédent, avec le total perpétuel.
// La table est protégée en ajout seul au niveau de la base.
@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  // Appelé dans une Prisma.$transaction, jamais seul
  async signReceipt(tx: Prisma.TransactionClient, siteId: string, input: SignReceiptInput): Promise<SignedReceipt> {
    // Verrou par site jusqu'à la fin de la transaction : les ventes simultanées
    // prennent leur numéro l'une après l'autre (compteur sans trou ni doublon)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'receipt:' + siteId}))`

    const last = await tx.receiptChain.findFirst({
      where: { siteId },
      orderBy: { counter: 'desc' },
      select: { counter: true, hash: true, perpetualTotal: true, perpetualAbsTotal: true },
    })

    // Premier maillon v2 après un historique v1 : les totaux perpétuels
    // reprennent tout l'historique, ils ne repartent jamais de zéro
    let previousPerpetual = new Decimal(0)
    let previousAbs = new Decimal(0)
    if (last?.perpetualTotal != null && last.perpetualAbsTotal != null) {
      previousPerpetual = last.perpetualTotal
      previousAbs = last.perpetualAbsTotal
    } else if (last) {
      const sums = await this.historicSums(tx, siteId, last.counter)
      previousPerpetual = sums.total
      previousAbs = sums.abs
    }

    const counter = (last?.counter ?? 0) + 1
    const previousHash = last?.hash ?? RECEIPT_GENESIS_HASH
    const signedAt = new Date()
    const perpetualTotal = previousPerpetual.add(input.total)
    const perpetualAbsTotal = previousAbs.add(input.total.abs())
    const contentDigest = sha256(input.content)
    const ledgerKind = input.kind === 'REFUND' ? 'REFUND' : 'SALE'

    const hash = sha256(
      ledgerEntryInput({
        previousHash,
        counter,
        signedAt: signedAt.toISOString(),
        siteId,
        terminalId: input.terminal?.terminalId,
        kind: ledgerKind,
        total: input.total.toFixed(2),
        perpetualTotal: perpetualTotal.toFixed(2),
        perpetualAbsTotal: perpetualAbsTotal.toFixed(2),
        contentDigest,
        terminalSignature: input.terminal?.terminalSignature,
      }),
    )

    const receipt = await tx.receiptChain.create({
      data: {
        siteId,
        counter,
        hash,
        previousHash,
        total: input.total,
        signedAt,
        version: 2,
        kind: input.kind,
        contentDigest,
        perpetualTotal,
        perpetualAbsTotal,
        ...input.terminal,
      },
    })

    return { id: receipt.id, counter, hash, previousHash, signedAt }
  }

  // Cumuls de l'historique jusqu'au ticket n° `upTo` inclus
  async historicSums(db: Prisma.TransactionClient | PrismaService, siteId: string, upTo: number) {
    const rows = await db.$queryRaw<Array<{ total: Decimal | null; abs: Decimal | null }>>`
      SELECT COALESCE(SUM("total"), 0) AS total, COALESCE(SUM(ABS("total")), 0) AS abs
      FROM "ReceiptChain" WHERE "siteId" = ${siteId} AND "counter" <= ${upTo}`
    return { total: new Decimal(rows[0]?.total ?? 0), abs: new Decimal(rows[0]?.abs ?? 0) }
  }

  // Totaux perpétuels au ticket n° `counter` (ou au dernier ticket)
  async perpetualAt(db: Prisma.TransactionClient | PrismaService, siteId: string, counter?: number | null) {
    const receipt = await db.receiptChain.findFirst({
      where: { siteId, ...(counter != null ? { counter } : {}) },
      orderBy: { counter: 'desc' },
      select: { counter: true, perpetualTotal: true, perpetualAbsTotal: true },
    })
    if (!receipt) return { counter: 0, total: new Decimal(0), abs: new Decimal(0) }
    if (receipt.perpetualTotal != null && receipt.perpetualAbsTotal != null) {
      return { counter: receipt.counter, total: receipt.perpetualTotal, abs: receipt.perpetualAbsTotal }
    }
    const sums = await this.historicSums(db, siteId, receipt.counter)
    return { counter: receipt.counter, ...sums }
  }

  // Revérifie le grand livre d'un site : numérotation continue, chaînage,
  // empreinte de chaque maillon (v1 et v2) et continuité du total perpétuel
  async verifyChain(siteId: string, range: { from?: number; to?: number } = {}) {
    const where = {
      siteId,
      ...(range.from || range.to ? { counter: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    }
    const receipts = await this.prisma.receiptChain.findMany({ where, orderBy: { counter: 'asc' } })
    if (receipts.length === 0) return { valid: true, checked: 0, firstCounter: null, lastCounter: null, errors: [] as string[] }

    const errors: string[] = []
    // Point de départ : le maillon précédant la plage vérifiée
    const before = receipts[0].counter > 1
      ? await this.prisma.receiptChain.findUnique({ where: { siteId_counter: { siteId, counter: receipts[0].counter - 1 } } })
      : null
    if (receipts[0].counter > 1 && !before) errors.push(`Ticket n° ${receipts[0].counter - 1} introuvable`)
    let previousHash = before?.hash ?? RECEIPT_GENESIS_HASH
    let previousCounter = receipts[0].counter - 1
    let perpetual: Decimal | null = null
    let perpetualAbs: Decimal | null = null
    if (before) {
      const p = await this.perpetualAt(this.prisma, siteId, before.counter)
      perpetual = p.total
      perpetualAbs = p.abs
    } else {
      perpetual = new Decimal(0)
      perpetualAbs = new Decimal(0)
    }

    // Ventes des tickets vérifiés, lues par paquets : le contenu stocké est
    // comparé à l'empreinte scellée dans le ticket
    const sales = new Map<string, Awaited<ReturnType<ComplianceService['loadSales']>>[number]>()
    let contentChecked = 0
    let contentNotChecked = 0

    for (const [index, r] of receipts.entries()) {
      if (r.version >= 2 && r.contentDigest && !sales.has(r.id)) {
        const chunk = receipts.slice(index, index + SALES_CHUNK).filter((x) => x.version >= 2 && x.contentDigest).map((x) => x.id)
        for (const sale of await this.loadSales(chunk)) sales.set(sale.receiptChainId!, sale)
      }
      if (r.counter !== previousCounter + 1) errors.push(`Trou dans la numérotation : ${previousCounter} puis ${r.counter}`)
      if (r.previousHash !== previousHash) errors.push(`Chaîne rompue au ticket n° ${r.counter}`)

      let expected: string
      if (r.version >= 2) {
        expected = sha256(
          ledgerEntryInput({
            previousHash: r.previousHash,
            counter: r.counter,
            signedAt: r.signedAt.toISOString(),
            siteId: r.siteId,
            terminalId: r.terminalId,
            kind: r.kind === 'REFUND' ? 'REFUND' : 'SALE',
            total: r.total.toFixed(2),
            perpetualTotal: r.perpetualTotal?.toFixed(2) ?? '0.00',
            perpetualAbsTotal: r.perpetualAbsTotal?.toFixed(2) ?? '0.00',
            contentDigest: r.contentDigest ?? '',
            terminalSignature: r.terminalSignature,
          }),
        )
        const nextTotal = perpetual!.add(r.total)
        const nextAbs = perpetualAbs!.add(r.total.abs())
        if (!r.perpetualTotal?.equals(nextTotal) || !r.perpetualAbsTotal?.equals(nextAbs)) {
          errors.push(`Total perpétuel incohérent au ticket n° ${r.counter}`)
        }
      } else {
        expected = sha256(ledgerEntryInputV1({ previousHash: r.previousHash, total: r.total.toString(), signedAt: r.signedAt.toISOString(), counter: r.counter }))
      }
      if (expected !== r.hash) errors.push(`Empreinte incorrecte au ticket n° ${r.counter}`)

      // Contenu : recalcul de l'empreinte depuis les lignes et paiements stockés.
      // Les anciens tickets (v1) n'ont pas d'empreinte de contenu : non vérifiable.
      if (r.version >= 2 && r.contentDigest) {
        const sale = sales.get(r.id)
        if (!sale) {
          errors.push(`Vente introuvable pour le ticket n° ${r.counter}`)
        } else {
          const kind = r.kind === 'REFUND' ? 'REFUND' : 'SALE'
          const check = checkSaleDigest({ terminalId: r.terminalId, total: r.total }, kind, sale, r.contentDigest)
          if (check === 'altered') errors.push(`Contenu altéré au ticket n° ${r.counter}`)
          else if (check === 'unverifiable') contentNotChecked++
          else contentChecked++
          if (!sale.total.equals(r.total)) errors.push(`Contenu altéré au ticket n° ${r.counter} (montant de la vente différent du ticket)`)
        }
      } else {
        contentNotChecked++
      }

      perpetual = perpetual!.add(r.total)
      perpetualAbs = perpetualAbs!.add(r.total.abs())
      previousHash = r.hash
      previousCounter = r.counter
    }

    return {
      valid: errors.length === 0,
      checked: receipts.length,
      firstCounter: receipts[0].counter,
      lastCounter: receipts[receipts.length - 1].counter,
      perpetualTotal: perpetual!.toFixed(2),
      perpetualAbsTotal: perpetualAbs!.toFixed(2),
      contentChecked,
      contentNotChecked,
      errors: errors.slice(0, 50),
    }
  }

  // Vente de chaque ticket, avec de quoi recalculer l'empreinte de son contenu
  private loadSales(receiptChainIds: string[]) {
    return this.prisma.order.findMany({
      where: { receiptChainId: { in: receiptChainIds } },
      select: {
        receiptChainId: true,
        kind: true,
        refundOfId: true,
        total: true,
        discount: true,
        items: {
          select: {
            id: true, refundOfItemId: true, productId: true, variantId: true, name: true, variantName: true, serialNumber: true,
            price: true, taxRate: true, quantity: true, discount: true, modifiers: true, menuProductId: true, menuName: true,
            menuGroup: true, weight: true, scaleLabel: true,
            product: { select: { isCustom: true } },
          },
        },
        payments: { select: { id: true, code: true, kind: true, amount: true, reference: true } },
      },
    })
  }
}
