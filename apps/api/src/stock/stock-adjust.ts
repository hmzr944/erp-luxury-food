import { ConflictException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Écritures de stock partagées par les ventes, les corrections et les
// inventaires. Tout passe par le client de transaction reçu : l'appelant
// décide de ce qui doit réussir ou échouer ensemble.

export interface StockTarget {
  siteId: string
  productId: string
  variantId: string | null
}

export interface StockRow {
  quantity: Decimal
  unit: string
  alertAt: Decimal | null
}

export async function readStock(tx: Prisma.TransactionClient, t: StockTarget): Promise<StockRow | null> {
  if (t.variantId) {
    const row = await tx.variantStock.findUnique({ where: { variantId: t.variantId } })
    return row ? { quantity: row.quantity, unit: 'unité', alertAt: row.alertAt } : null
  }
  const row = await tx.stockItem.findUnique({ where: { productId: t.productId } })
  return row ? { quantity: row.quantity, unit: row.unit, alertAt: row.alertAt } : null
}

// Applique un écart signé à la quantité en stock et rend la nouvelle quantité.
// L'écriture est gardée par la quantité lue : si une vente est passée entre
// la lecture et l'écriture, on s'arrête plutôt que d'écraser sa sortie.
// Sans ligne de stock, elle est créée (jamais sous zéro).
export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  t: StockTarget,
  delta: Decimal,
  unit = 'unité',
): Promise<{ before: Decimal; after: Decimal }> {
  const current = await readStock(tx, t)
  if (!current) {
    const after = Decimal.max(delta, 0)
    if (t.variantId) {
      await tx.variantStock.create({ data: { variantId: t.variantId, siteId: t.siteId, quantity: after } })
    } else {
      await tx.stockItem.create({ data: { productId: t.productId, siteId: t.siteId, quantity: after, unit } })
    }
    return { before: new Decimal(0), after }
  }
  const after = Decimal.max(current.quantity.add(delta), 0)
  const res = t.variantId
    ? await tx.variantStock.updateMany({ where: { variantId: t.variantId, quantity: current.quantity }, data: { quantity: after } })
    : await tx.stockItem.updateMany({ where: { productId: t.productId, quantity: current.quantity }, data: { quantity: after } })
  if (res.count === 0) {
    throw new ConflictException('Le stock a changé pendant la saisie (une vente vient de passer). Réessayez.')
  }
  return { before: current.quantity, after }
}

// Sortie de lots, dates limites les plus proches d'abord. Rend le premier lot entamé.
export async function consumeLotsFefo(
  tx: Prisma.TransactionClient,
  t: StockTarget,
  qty: Decimal,
): Promise<string | null> {
  const lots = await tx.stockLot.findMany({
    where: { siteId: t.siteId, productId: t.productId, variantId: t.variantId, serialNumber: null, quantity: { gt: 0 } },
    orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
  })
  let left = qty
  let first: string | null = null
  for (const lot of lots) {
    if (left.lte(0)) break
    const take = Decimal.min(lot.quantity, left)
    await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: lot.quantity.sub(take) } })
    first ??= lot.id
    left = left.sub(take)
  }
  return first
}
