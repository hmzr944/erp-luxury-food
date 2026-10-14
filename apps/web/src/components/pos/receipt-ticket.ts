import type { ReceiptSettings } from '@/lib/api/platform'
import { buildSaleTicket, SERVICE_NOTE_THRESHOLD, type TicketModel } from '@/lib/printing/ticket'
import type { ReceiptView } from './PaymentSheet'
import { receiptUrl } from '@/lib/receipts'

// Ticket imprimable d'une vente de la caisse (ou d'une vente de formation)
export function ticketForSale(
  view: ReceiptView,
  ctx: { receipt?: ReceiptSettings; siteName: string; sellerName?: string | null },
  extra: { duplicate?: number; copy?: 'CLIENT' | 'DOUBLE' } = {},
): TicketModel {
  const { sale } = view
  const priced = sale.pricing.lines
  return buildSaleTicket({
    receipt: ctx.receipt,
    siteName: ctx.siteName,
    terminalName: sale.terminalName,
    sellerName: ctx.sellerName,
    number: view.training ? `F-${view.training.number}` : String(sale.receipt.counter),
    signedAt: new Date(sale.receipt.signedAt),
    lines: view.lines.map((l, i) => {
      const ttc = priced[i]?.ttc ?? l.product.price * l.quantity - l.discount
      return {
        quantity: l.quantity,
        name: l.customName ?? l.product.name,
        detail: [l.variantName, l.serialNumber ? `N° de série ${l.serialNumber}` : null].filter(Boolean).join(', ') || undefined,
        unit: Math.round((ttc / l.quantity) * 100) / 100,
        total: ttc,
        taxRate: l.product.taxRate,
      }
    }),
    discount: sale.pricing.discount || undefined,
    total: sale.pricing.total,
    taxBreakdown: sale.pricing.taxBreakdown,
    payments: view.payments,
    change: view.change,
    signature: view.training ? undefined : sale.receipt.hash.slice(0, 16),
    training: view.training ? { operator: view.training.operator } : undefined,
    duplicate: extra.duplicate,
    copy: extra.copy,
    // Le double conservé par le commerçant n'a pas besoin du lien
    receiptUrl: view.training || extra.copy === 'DOUBLE' ? undefined : receiptUrl(sale.clientId),
  })
}

// Impression automatique : ticket demandé par la politique du commerce, ou
// obligatoire (pièce numérotée sous garantie, note de service dès 25 €)
export function printPlan(view: ReceiptView, receipt?: ReceiptSettings): { auto: boolean; copies: Array<'CLIENT' | 'DOUBLE' | undefined> } {
  const note = !!receipt?.serviceNote && view.sale.pricing.total >= SERVICE_NOTE_THRESHOLD && !view.training
  const warranty = view.lines.some((l) => l.serialNumber)
  const auto = note || warranty || receipt?.policy === 'ALWAYS'
  return { auto, copies: note ? ['CLIENT', 'DOUBLE'] : [undefined] }
}
