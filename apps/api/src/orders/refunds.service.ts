import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Decimal } from '@prisma/client/runtime/library'
import { Prisma, type PaymentKind } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { ComplianceService } from '../compliance/compliance.service'
import { PaymentsService } from '../payments/payments.service'
import { AuditService } from '../audit/audit.service'
import { creditCode, normalizeCreditCode } from './credits'
import { planRefund, RefundPlanError } from './refund-plan'
import type { RefundDto } from './dto/refund.dto'
import { GIFT_CARD_CODE, stableStringify } from '@erp/utils'

import { CustomersService } from '../customers/customers.service'

// Retours et avoirs. Un remboursement est un ticket négatif signé dans la
// même chaîne que les ventes : rien n'est effacé, tout se retrouve à l'audit.
// Ni délai imposé, ni frais cachés : c'est le commerçant qui fixe sa règle.
@Injectable()
export class RefundsService {
  constructor(
    private prisma: PrismaService,
    private compliance: ComplianceService,
    private payments: PaymentsService,
    private events: EventEmitter2,
    private audit: AuditService,
    private customers: CustomersService,
  ) {}

  async refund(siteId: string, orderId: string, dto: RefundDto, user: { id: string; organizationId: string; email?: string }) {
    const sale = await this.prisma.order.findFirst({
      where: { id: orderId, siteId },
      include: { items: true, payments: true, refunds: { include: { items: true } } },
    })
    if (!sale) throw new NotFoundException('Vente introuvable')
    if (sale.kind !== 'SALE') throw new BadRequestException("Un remboursement ne se rembourse pas : refaites une vente")
    if (sale.status === 'CANCELLED') throw new BadRequestException('Cette vente est annulée')

    const plan = this.plan(sale, dto.lines)

    // Rembourser sur le moyen d'origine n'a de sens que s'il est unique
    const original = sale.payments.filter((p) => Number(p.amount) > 0)
    let method: { code: string; label: string; kind: PaymentKind; reference?: string | null }
    // Vente payée par avoir : on rend un nouvel avoir
    const toCredit = dto.refundTo === 'CREDIT' || (dto.refundTo === 'ORIGINAL' && original.length === 1 && original[0].code === 'CREDIT')
    if (dto.refundTo === 'ORIGINAL' && !toCredit) {
      if (original.length !== 1) {
        throw new BadRequestException('Vente payée en plusieurs fois : remboursez en espèces ou en avoir')
      }
      method = { code: original[0].code, label: original[0].label, kind: original[0].kind }
    } else if (dto.refundTo === 'CASH') {
      method = { code: 'CASH', label: 'Espèces', kind: 'CASH' }
    } else {
      method = { code: 'CREDIT', label: 'Avoir', kind: 'VOUCHER' }
    }

    // Carte cadeau déjà entamée : refus avant tout remboursement sur la carte bancaire
    const byId = new Map(sale.items.map((i) => [i.id, i.name]))
    await this.cancelGiftCards(this.prisma, sale.id, plan.lines.map((l) => byId.get(l.orderItemId) ?? ''), false)

    // Carte passée sur un TPE connecté : on rembourse la carte avant
    // d'écrire quoi que ce soit. Si le prestataire refuse, rien n'est enregistré.
    if (dto.refundTo === 'ORIGINAL' && original[0].reference && original[0].kind === 'CARD') {
      const done = await this.payments.refundByReference(user.organizationId, original[0].reference, Math.round(plan.total * 100))
      if (done) method.reference = done.refundRef
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Deux retours simultanés de la même vente : l'un après l'autre
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'refund:' + sale.id}))`
      const fresh = await tx.order.findMany({ where: { refundOfId: sale.id }, include: { items: true } })
      if (fresh.length !== sale.refunds.length) this.plan({ ...sale, refunds: fresh }, dto.lines)

      const credit = toCredit
          ? await tx.storeCredit.create({
              data: {
                organizationId: user.organizationId,
                code: creditCode(),
                initialAmount: new Decimal(plan.total),
                balance: new Decimal(plan.total),
                customerEmail: dto.customerEmail ?? sale.customerEmail,
                expiresAt: dto.creditMonths ? addMonths(new Date(), dto.creditMonths) : null,
              },
            })
          : null
      if (credit) method.reference = credit.code

      const receipt = await this.compliance.signReceipt(tx, siteId, {
        total: new Decimal(-plan.total),
        kind: 'REFUND',
        content: stableStringify({
          refundOf: sale.id,
          lines: plan.lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity, ttc: l.ttc.toFixed(2), taxRate: Number(l.taxRate).toFixed(2) })),
          payment: { code: method.code, amount: (-plan.total).toFixed(2), reference: method.reference ?? null },
        }),
      })
      const byItem = new Map(sale.items.map((i) => [i.id, i]))
      const refund = await tx.order.create({
        data: {
          siteId,
          kind: 'REFUND',
          refundOfId: sale.id,
          refundReason: dto.reason?.trim() || null,
          channel: sale.channel,
          status: 'COMPLETED',
          subtotal: new Decimal(-plan.subtotal),
          taxAmount: new Decimal(-plan.taxAmount),
          total: new Decimal(-plan.total),
          paymentMode: original.length === 1 && dto.refundTo === 'ORIGINAL' ? sale.paymentMode : 'MIXED',
          customerEmail: dto.customerEmail ?? sale.customerEmail,
          note: [user.email ? `Remboursé par ${user.email}` : null, dto.restock ? 'Remis en stock' : 'Non remis en stock']
            .filter(Boolean)
            .join('\n'),
          receiptChainId: receipt.id,
          items: {
            create: plan.lines.map((l) => {
              const src = byItem.get(l.orderItemId)!
              return {
                productId: src.productId,
                variantId: src.variantId,
                name: src.name,
                variantName: src.variantName,
                serialNumber: src.serialNumber,
                modifiers: src.modifiers ?? Prisma.DbNull,
                menuProductId: src.menuProductId,
                menuName: src.menuName,
                menuGroup: src.menuGroup,
                weight: src.weight,
                pricePerKg: src.pricePerKg,
                scaleLabel: src.scaleLabel,
                quantity: l.quantity,
                // Montant réellement rendu par unité (remises comprises)
                price: new Decimal(-l.ttc / l.quantity).toDecimalPlaces(2),
                taxRate: new Decimal(l.taxRate),
                discount: new Decimal(0),
                refundOfItemId: l.orderItemId,
              }
            }),
          },
          payments: {
            create: [{ code: method.code, label: method.label, kind: method.kind, amount: new Decimal(-plan.total), reference: method.reference ?? null }],
          },
        },
        include: { items: true, payments: true, receiptChain: { select: { counter: true, signedAt: true } } },
      })
      if (credit) await tx.storeCredit.update({ where: { id: credit.id }, data: { issuedOrderId: refund.id } })
      await this.cancelGiftCards(tx, sale.id, plan.lines.map((l) => byItem.get(l.orderItemId)!.name), true)
      const giftValue = (items: Array<{ name: string; price: Decimal; quantity: number }>) =>
        items.filter((i) => GIFT_CARD_CODE.test(i.name)).reduce((a, i) => a + Number(i.price) * i.quantity, 0)
      await this.customers.reverseForRefund(tx, sale, refund.id, {
        refunded: plan.total,
        refundedGiftCards: giftValue(plan.lines.map((l) => ({ ...byItem.get(l.orderItemId)!, quantity: l.quantity }))),
        saleGiftCards: giftValue(sale.items),
      })

      if (dto.restock) {
        for (const l of plan.lines) await this.restock(tx, siteId, byItem.get(l.orderItemId)!, l.quantity, refund.id, user.id)
      }
      return { refund, credit }
    })

    this.events.emit('order.created', { siteId, order: result.refund })
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'refund.created',
      target: sale.id,
      detail: `${plan.total.toFixed(2)} € en ${method.label}${dto.reason ? `, ${dto.reason}` : ''}`,
    })
    return {
      ...result.refund,
      credit: result.credit ? { code: result.credit.code, balance: Number(result.credit.balance), expiresAt: result.credit.expiresAt } : null,
    }
  }

  // Ce qu'il reste à rembourser, ligne par ligne (pour l'écran de retour)
  remaining(sale: { items: Array<{ id: string; quantity: number }>; refunds: Array<{ items: Array<{ refundOfItemId: string | null; quantity: number }> }> }) {
    const qty = refundedQty(sale.refunds)
    return Object.fromEntries(sale.items.map((i) => [i.id, i.quantity - (qty[i.id] ?? 0)]))
  }

  async creditBalance(organizationId: string, rawCode: string) {
    const code = normalizeCreditCode(rawCode)
    const credit = await this.prisma.storeCredit.findFirst({
      where: { organizationId, code },
      select: { code: true, kind: true, balance: true, initialAmount: true, expiresAt: true, createdAt: true },
    })
    if (!credit) throw new NotFoundException(`Avoir ou carte cadeau ${code} introuvable`)
    const expired = !!credit.expiresAt && credit.expiresAt < new Date()
    return { ...credit, balance: Number(credit.balance), initialAmount: Number(credit.initialAmount), expired }
  }

  // Carte cadeau rendue : elle doit être intacte, puis elle ne vaut plus rien
  private async cancelGiftCards(tx: Prisma.TransactionClient, saleId: string, lineNames: string[], apply: boolean) {
    const codes = lineNames.map((n) => n.match(GIFT_CARD_CODE)?.[0]).filter((c): c is string => !!c)
    if (!codes.length) return
    const cards = await tx.storeCredit.findMany({ where: { soldOrderId: saleId, kind: 'GIFT_CARD', code: { in: codes } } })
    for (const c of cards) {
      if (!c.balance.equals(c.initialAmount)) throw new BadRequestException(`Carte cadeau ${c.code} déjà utilisée : remboursement impossible`)
      if (apply) await tx.storeCredit.update({ where: { id: c.id }, data: { balance: new Decimal(0) } })
    }
  }

  private plan(
    sale: {
      total: Decimal
      items: Array<{ id: string; name: string; quantity: number; price: Decimal; discount: Decimal; taxRate: Decimal }>
      refunds: Array<{ total: Decimal; items: Array<{ refundOfItemId: string | null; quantity: number }> }>
    },
    lines: RefundDto['lines'],
  ) {
    try {
      return planRefund({
        total: Number(sale.total),
        items: sale.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: Number(i.price), discount: Number(i.discount), taxRate: Number(i.taxRate) })),
        alreadyRefundedQty: refundedQty(sale.refunds),
        alreadyRefundedAmount: sale.refunds.reduce((a, r) => a - Number(r.total), 0),
        lines,
      })
    } catch (e) {
      if (e instanceof RefundPlanError) throw new BadRequestException(e.message)
      throw e
    }
  }

  private async restock(
    tx: Prisma.TransactionClient,
    siteId: string,
    item: { productId: string; variantId: string | null; serialNumber: string | null; weight: Decimal | null },
    quantity: number,
    orderId: string,
    userId: string,
  ) {
    // Article pesé : son poids revient en stock
    const qty = item.weight ? item.weight.mul(quantity) : new Decimal(quantity)
    if (item.variantId) {
      await tx.variantStock.updateMany({ where: { variantId: item.variantId }, data: { quantity: { increment: qty } } })
    } else {
      await tx.stockItem.updateMany({ where: { productId: item.productId }, data: { quantity: { increment: qty } } })
    }
    // La pièce numérotée redevient vendable
    let lotId: string | null = null
    if (item.serialNumber) {
      const lot = await tx.stockLot.findFirst({ where: { productId: item.productId, serialNumber: item.serialNumber }, select: { id: true } })
      if (lot) {
        await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: 1 } })
        lotId = lot.id
      }
    }
    await tx.stockMovement.create({
      data: { siteId, productId: item.productId, variantId: item.variantId, lotId, type: 'RESTOCK', quantity: qty, reason: 'Retour client', orderId, userId },
    })
  }
}

function refundedQty(refunds: Array<{ items: Array<{ refundOfItemId: string | null; quantity: number }> }>) {
  const qty: Record<string, number> = {}
  for (const r of refunds) for (const i of r.items) if (i.refundOfItemId) qty[i.refundOfItemId] = (qty[i.refundOfItemId] ?? 0) + i.quantity
  return qty
}

function addMonths(d: Date, months: number) {
  const r = new Date(d)
  r.setMonth(r.getMonth() + months)
  return r
}
