import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'

// Produits traités par transaction : un gros catalogue ne bloque pas la base
// et une panne en route se rattrape en relançant la copie (rien n'est dupliqué)
const BATCH = 100
const MAX_LISTED = 50

export type SkipReason = 'sku' | 'barcode' | 'name'

export interface CatalogCopyReport {
  // Rayons et groupes d'options créés (ceux de même nom sont réutilisés)
  categories: number
  modifierGroups: number
  products: number
  variants: number
  menus: number
  // Déjà présents dans la cible : jamais dupliqués
  skipped: number
  skippedItems: Array<{ name: string; reason: SkipReason }>
  // Articles d'exemple de la source, volontairement laissés de côté
  samplesExcluded: number
  // Codes-barres ou SKU de variantes déjà pris dans la cible : copiés sans le code
  variantCodesCleared: number
}

const norm = (s: string) => s.trim().toLocaleLowerCase('fr')

const SOURCE_INCLUDE = {
  variants: { where: { isActive: true }, orderBy: { position: 'asc' } },
  options: { orderBy: { position: 'asc' } },
  modifierGroups: { orderBy: { position: 'asc' } },
  menuSteps: { orderBy: { position: 'asc' }, include: { choices: { orderBy: { position: 'asc' } } } },
} satisfies Prisma.ProductInclude

type SourceProduct = Prisma.ProductGetPayload<{ include: typeof SOURCE_INCLUDE }>

// Copie le CATALOGUE d'un site vers un autre de la même organisation : rayons,
// articles, variantes, groupes d'options, formules. Jamais de stock, de lot,
// de mouvement, de vente, de caisse ni de client : la cible démarre à zéro.
@Injectable()
export class CatalogCopyService {
  constructor(private prisma: PrismaService) {}

  // Les deux sites doivent appartenir à l'organisation de l'appelant
  async assertCopyable(targetSiteId: string, sourceSiteId: string, organizationId: string) {
    if (targetSiteId === sourceSiteId) throw new BadRequestException('Choisissez un autre site que celui à remplir')
    const sites = await this.prisma.site.findMany({
      where: { id: { in: [targetSiteId, sourceSiteId] }, organizationId },
      select: { id: true },
    })
    const ids = new Set(sites.map((s) => s.id))
    if (!ids.has(targetSiteId)) throw new NotFoundException('Site introuvable')
    if (!ids.has(sourceSiteId)) throw new NotFoundException('Site à copier introuvable')
  }

  async copy(targetSiteId: string, sourceSiteId: string, organizationId: string): Promise<CatalogCopyReport> {
    await this.assertCopyable(targetSiteId, sourceSiteId, organizationId)

    const [source, existing, srcCategories, dstCategories, srcGroups, dstGroups] = await Promise.all([
      this.prisma.product.findMany({
        where: { siteId: sourceSiteId, isActive: true, isCustom: false, isGiftCard: false },
        include: SOURCE_INCLUDE,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.product.findMany({
        where: { siteId: targetSiteId },
        select: { id: true, name: true, sku: true, barcode: true, variants: { select: { barcode: true, sku: true } } },
      }),
      this.prisma.category.findMany({ where: { siteId: sourceSiteId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
      this.prisma.category.findMany({ where: { siteId: targetSiteId } }),
      this.prisma.modifierGroup.findMany({
        where: { siteId: sourceSiteId, isActive: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { modifiers: { where: { isActive: true }, orderBy: { position: 'asc' } } },
      }),
      this.prisma.modifierGroup.findMany({ where: { siteId: targetSiteId }, select: { id: true, name: true } }),
    ])

    const report: CatalogCopyReport = {
      categories: 0, modifierGroups: 0, products: 0, variants: 0, menus: 0,
      skipped: 0, skippedItems: [], samplesExcluded: 0, variantCodesCleared: 0,
    }
    const samples = source.filter((p) => p.isSample)
    report.samplesExcluded = samples.length
    const candidates = source.filter((p) => !p.isSample)

    // Clés déjà prises dans la cible (et au fil de la copie : deux articles de
    // la source qui se ressemblent ne font pas deux articles dans la cible)
    const bySku = new Map<string, string>()
    const byBarcode = new Map<string, string>()
    const byName = new Map<string, string>()
    const codes = new Set<string>()
    for (const p of existing) {
      if (p.sku) bySku.set(norm(p.sku), p.id)
      if (p.barcode) byBarcode.set(p.barcode.trim(), p.id)
      byName.set(norm(p.name), p.id)
      if (p.barcode) codes.add(p.barcode.trim())
      if (p.sku) codes.add(norm(p.sku))
      for (const v of p.variants) {
        if (v.barcode) codes.add(v.barcode.trim())
        if (v.sku) codes.add(norm(v.sku))
      }
    }

    // Rayons et groupes d'options : réutilisés s'ils existent déjà (même nom)
    const categoryMap = new Map<string, string>()
    const groupMap = new Map<string, string>()
    await this.prisma.$transaction(async (tx) => {
      const dstCat = new Map(dstCategories.map((c) => [norm(c.name), c.id]))
      let position = dstCategories.reduce((m, c) => Math.max(m, c.position), -1)
      for (const c of srcCategories) {
        let id = dstCat.get(norm(c.name))
        if (!id) {
          position += 1
          id = (await tx.category.create({ data: { siteId: targetSiteId, name: c.name, color: c.color, position } })).id
          dstCat.set(norm(c.name), id)
          report.categories += 1
        }
        categoryMap.set(c.id, id)
      }
      const dstGroup = new Map(dstGroups.map((g) => [norm(g.name), g.id]))
      let gPosition = await tx.modifierGroup
        .aggregate({ where: { siteId: targetSiteId }, _max: { position: true } })
        .then((a) => a._max.position ?? 0)
      for (const g of srcGroups) {
        let id = dstGroup.get(norm(g.name))
        if (!id) {
          gPosition += 1
          id = (
            await tx.modifierGroup.create({
              data: {
                siteId: targetSiteId,
                name: g.name,
                minSelect: g.minSelect,
                maxSelect: g.maxSelect,
                position: gPosition,
                modifiers: { create: g.modifiers.map((m, i) => ({ name: m.name, price: m.price, position: i })) },
              },
            })
          ).id
          dstGroup.set(norm(g.name), id)
          report.modifierGroups += 1
        }
        groupMap.set(g.id, id)
      }
    })

    // Articles simples d'abord, formules ensuite (elles pointent vers des articles)
    const productMap = new Map<string, string>() // id source -> id cible (créé ou déjà présent)
    const variantMap = new Map<string, string>()
    const toCreate: SourceProduct[] = []
    for (const p of candidates) {
      const hit = this.findExisting(p, bySku, byBarcode, byName)
      if (hit) {
        productMap.set(p.id, hit.id)
        report.skipped += 1
        if (report.skippedItems.length < MAX_LISTED) report.skippedItems.push({ name: p.name, reason: hit.reason })
        continue
      }
      if (p.sku) bySku.set(norm(p.sku), p.id)
      if (p.barcode) byBarcode.set(p.barcode.trim(), p.id)
      byName.set(norm(p.name), p.id)
      toCreate.push(p)
    }
    const plain = toCreate.filter((p) => !p.isMenu)
    const menus = toCreate.filter((p) => p.isMenu)

    for (let i = 0; i < plain.length; i += BATCH) {
      const chunk = plain.slice(i, i + BATCH)
      await this.prisma.$transaction(
        async (tx) => {
          for (const p of chunk) {
            const created = await tx.product.create({
              data: this.productData(p, targetSiteId, categoryMap, groupMap, codes, report),
              select: { id: true, variants: { select: { id: true, position: true }, orderBy: { position: 'asc' } } },
            })
            productMap.set(p.id, created.id)
            report.products += 1
            report.variants += created.variants.length
            created.variants.forEach((v, idx) => {
              const src = p.variants[idx]
              if (src) variantMap.set(src.id, v.id)
            })
          }
        },
        { timeout: 60_000 },
      )
    }

    for (let i = 0; i < menus.length; i += BATCH) {
      const chunk = menus.slice(i, i + BATCH)
      await this.prisma.$transaction(
        async (tx) => {
          for (const p of chunk) {
            const steps = p.menuSteps.map((st, position) => ({
              name: st.name,
              minSelect: st.minSelect,
              maxSelect: st.maxSelect,
              position,
              choices: {
                create: st.choices
                  .filter((c) => productMap.has(c.productId))
                  .map((c, idx) => ({
                    productId: productMap.get(c.productId)!,
                    variantId: c.variantId ? (variantMap.get(c.variantId) ?? null) : null,
                    supplement: c.supplement,
                    position: idx,
                  })),
              },
            }))
            const created = await tx.product.create({
              data: {
                ...this.productData(p, targetSiteId, categoryMap, groupMap, codes, report),
                menuSteps: { create: steps },
              },
              select: { id: true },
            })
            productMap.set(p.id, created.id)
            report.products += 1
            report.menus += 1
          }
        },
        { timeout: 60_000 },
      )
    }
    return report
  }

  private findExisting(
    p: { name: string; sku: string | null; barcode: string | null },
    bySku: Map<string, string>,
    byBarcode: Map<string, string>,
    byName: Map<string, string>,
  ): { id: string; reason: SkipReason } | null {
    const sku = p.sku ? bySku.get(norm(p.sku)) : undefined
    if (sku) return { id: sku, reason: 'sku' }
    const barcode = p.barcode ? byBarcode.get(p.barcode.trim()) : undefined
    if (barcode) return { id: barcode, reason: 'barcode' }
    const name = byName.get(norm(p.name))
    if (name) return { id: name, reason: 'name' }
    return null
  }

  // Attributs du catalogue seulement : ni stock, ni lot, ni identifiants de vente
  private productData(
    p: SourceProduct,
    siteId: string,
    categoryMap: Map<string, string>,
    groupMap: Map<string, string>,
    codes: Set<string>,
    report: CatalogCopyReport,
  ): Prisma.ProductUncheckedCreateInput {
    const variants = p.variants.map((v, position) => {
      let barcode = v.barcode?.trim() || null
      let sku = v.sku ? norm(v.sku) : null
      if ((barcode && codes.has(barcode)) || (sku && codes.has(sku))) {
        report.variantCodesCleared += 1
        barcode = null
        sku = null
      }
      if (barcode) codes.add(barcode)
      if (sku) codes.add(sku)
      return {
        name: v.name,
        price: v.price,
        barcode,
        sku: sku ? v.sku : null,
        options: (v.options ?? {}) as Prisma.InputJsonObject,
        position,
      }
    })
    const groupIds = [...new Set(p.modifierGroups.map((g) => groupMap.get(g.groupId)).filter((x): x is string => !!x))]
    return {
      siteId,
      name: p.name,
      subtitle: p.subtitle,
      description: p.description,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
      taxRate: p.taxRate,
      categoryId: p.categoryId ? (categoryMap.get(p.categoryId) ?? null) : null,
      imageUrl: p.imageUrl,
      attributes: (p.attributes ?? {}) as Prisma.InputJsonObject,
      tracking: p.tracking,
      mealVoucherEligible: p.mealVoucherEligible,
      isMenu: p.isMenu,
      soldByWeight: p.soldByWeight,
      scaleCode: p.scaleCode,
      options: { create: p.options.map((o, position) => ({ name: o.name, values: o.values, position })) },
      variants: { create: variants },
      modifierGroups: { create: groupIds.map((groupId, position) => ({ groupId, position })) },
    }
  }
}
