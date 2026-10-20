import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { consolidateStock, queryRows, type StockEntry, type StockQuery } from './stock-network'

// Lecture seule : aucune écriture, ne touche pas à la file de décrément
@Injectable()
export class StockNetworkService {
  constructor(private prisma: PrismaService) {}

  async consolidated(organizationId: string, query: StockQuery & { siteIds?: string[] }) {
    const allSites = await this.prisma.site.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    // Les sites demandés sont recoupés avec ceux de l'organisation : un
    // identifiant étranger est ignoré, il ne donne jamais accès à un autre réseau
    const wanted = query.siteIds?.length ? allSites.filter((s) => query.siteIds!.includes(s.id)) : allSites
    const siteIds = wanted.map((s) => s.id)
    const real = { isCustom: false, isGiftCard: false }

    const [items, variants] = siteIds.length
      ? await Promise.all([
          this.prisma.stockItem.findMany({
            where: { siteId: { in: siteIds }, product: real },
            select: {
              siteId: true, quantity: true, unit: true, alertAt: true,
              product: { select: { id: true, name: true, sku: true, barcode: true } },
            },
          }),
          this.prisma.variantStock.findMany({
            where: { siteId: { in: siteIds }, variant: { product: real } },
            select: {
              siteId: true, quantity: true, alertAt: true,
              variant: { select: { id: true, name: true, sku: true, barcode: true, product: { select: { id: true, name: true } } } },
            },
          }),
        ])
      : [[], []]

    const entries: StockEntry[] = [
      ...items.map((i) => ({
        siteId: i.siteId,
        productId: i.product.id,
        variantId: null,
        name: i.product.name,
        variantName: null,
        sku: i.product.sku,
        barcode: i.product.barcode,
        unit: i.unit,
        quantity: Number(i.quantity),
        alertAt: i.alertAt === null ? null : Number(i.alertAt),
      })),
      ...variants.map((v) => ({
        siteId: v.siteId,
        productId: v.variant.product.id,
        variantId: v.variant.id,
        name: v.variant.product.name,
        variantName: v.variant.name,
        sku: v.variant.sku,
        barcode: v.variant.barcode,
        unit: 'unité',
        quantity: Number(v.quantity),
        alertAt: v.alertAt === null ? null : Number(v.alertAt),
      })),
    ]
    // Ordre stable avant rapprochement : le nom affiché ne dépend pas de l'ordre de la base
    entries.sort((a, b) => a.siteId.localeCompare(b.siteId) || a.name.localeCompare(b.name, 'fr'))

    return { sites: wanted, ...queryRows(consolidateStock(entries), query) }
  }
}
