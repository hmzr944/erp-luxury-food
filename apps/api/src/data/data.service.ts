import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { modifiersLabel, parseCsv, toCsv } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { planProductImport, type ImportPlan } from './product-import'

const n = (d: Decimal | number | null | undefined) => (d === null || d === undefined ? null : Number(d))

// Les données appartiennent au commerçant : tout s'exporte, gratuitement,
// dans un format qu'un tableur ouvre directement
@Injectable()
export class DataService {
  constructor(private prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 31 * 86_400_000)
    const end = to ? new Date(to) : new Date()
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Dates illisibles')
    end.setHours(23, 59, 59, 999)
    return { gte: start, lte: end }
  }

  // Une ligne par article vendu
  async salesCsv(siteId: string, from?: string, to?: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { siteId, createdAt: this.range(from, to) } },
      include: {
        order: {
          select: {
            id: true, createdAt: true, soldAt: true, status: true, channel: true, paymentMode: true,
            receiptChain: { select: { counter: true, terminalCounter: true, terminal: { select: { name: true } } } },
          },
        },
        product: { select: { sku: true, category: { select: { name: true } } } },
      },
      orderBy: { order: { createdAt: 'asc' } },
    })
    return toCsv(items, [
      { header: 'Date', value: (i) => (i.order.soldAt ?? i.order.createdAt).toISOString() },
      { header: 'Commande', value: (i) => i.order.id },
      { header: 'Ticket site', value: (i) => i.order.receiptChain?.counter },
      { header: 'Caisse', value: (i) => i.order.receiptChain?.terminal?.name },
      { header: 'Ticket caisse', value: (i) => i.order.receiptChain?.terminalCounter },
      { header: 'Statut', value: (i) => i.order.status },
      { header: 'Canal', value: (i) => i.order.channel },
      { header: 'Produit', value: (i) => i.name },
      { header: 'Variante', value: (i) => i.variantName },
      { header: 'N° de série', value: (i) => i.serialNumber },
      { header: 'Formule', value: (i) => i.menuName },
      { header: 'Options', value: (i) => (Array.isArray(i.modifiers) ? modifiersLabel(i.modifiers as Array<{ name: string; price: number }>) : '') },
      { header: 'Poids (kg)', value: (i) => (i.weight ? n(i.weight) : '') },
      { header: 'SKU', value: (i) => i.product.sku },
      { header: 'Catégorie', value: (i) => i.product.category?.name },
      { header: 'Quantité', value: (i) => i.quantity },
      { header: 'Prix unitaire', value: (i) => n(i.price) },
      { header: 'Remise', value: (i) => n(i.discount) },
      { header: 'Taux TVA', value: (i) => n(i.taxRate) },
      { header: 'Montant ligne', value: (i) => Number(i.price) * i.quantity - Number(i.discount) },
    ])
  }

  // Une ligne par paiement : ce dont la comptabilité a besoin
  async paymentsCsv(siteId: string, from?: string, to?: string) {
    const orders = await this.prisma.order.findMany({
      where: { siteId, createdAt: this.range(from, to) },
      include: { payments: true, receiptChain: { select: { counter: true } } },
      orderBy: { createdAt: 'asc' },
    })
    // Commandes antérieures au détail des paiements : une ligne avec le mode historique
    const rows = orders.flatMap((o) =>
      (o.payments.length ? o.payments : [{ code: o.paymentMode, label: o.paymentMode, kind: '', amount: o.total }]).map((p) => ({ o, p })),
    )
    return toCsv(rows, [
      { header: 'Date', value: ({ o }) => (o.soldAt ?? o.createdAt).toISOString() },
      { header: 'Commande', value: ({ o }) => o.id },
      { header: 'Ticket site', value: ({ o }) => o.receiptChain?.counter },
      { header: 'Moyen de paiement', value: ({ p }) => p.label },
      { header: 'Code', value: ({ p }) => p.code },
      { header: 'Montant', value: ({ p }) => n(p.amount) },
      { header: 'Total HT commande', value: ({ o }) => n(o.subtotal) },
      { header: 'TVA commande', value: ({ o }) => n(o.taxAmount) },
      { header: 'Total TTC commande', value: ({ o }) => n(o.total) },
      { header: 'Statut', value: ({ o }) => o.status },
    ])
  }

  // Même format que l'import : un export peut être réimporté sur un autre site
  async productsCsv(siteId: string) {
    const products = await this.prisma.product.findMany({
      where: { siteId, isCustom: false },
      include: {
        category: { select: { name: true } },
        options: { orderBy: { position: 'asc' } },
        variants: { orderBy: { position: 'asc' }, include: { stock: true } },
        stockItem: true,
      },
      orderBy: { name: 'asc' },
    })
    type Row = { p: (typeof products)[number]; v?: (typeof products)[number]['variants'][number] }
    const rows: Row[] = products.flatMap((p) => (p.variants.length ? p.variants.map((v) => ({ p, v })) : [{ p }]))
    const opt = (r: Row, i: number) => {
      const axis = r.p.options[i]?.name
      return { axis, value: axis ? (r.v?.options as Record<string, string> | undefined)?.[axis] : undefined }
    }
    return toCsv(rows, [
      { header: 'nom', value: (r) => r.p.name },
      { header: 'sous_titre', value: (r) => r.p.subtitle },
      { header: 'description', value: (r) => r.p.description },
      { header: 'categorie', value: (r) => r.p.category?.name },
      { header: 'prix', value: (r) => n(r.v?.price ?? r.p.price) },
      { header: 'tva', value: (r) => n(r.p.taxRate) },
      { header: 'sku', value: (r) => r.v?.sku ?? r.p.sku },
      { header: 'code_barres', value: (r) => r.v?.barcode ?? r.p.barcode },
      { header: 'option_1', value: (r) => opt(r, 0).axis },
      { header: 'valeur_1', value: (r) => opt(r, 0).value },
      { header: 'option_2', value: (r) => opt(r, 1).axis },
      { header: 'valeur_2', value: (r) => opt(r, 1).value },
      { header: 'stock', value: (r) => n(r.v ? r.v.stock?.quantity : r.p.stockItem?.quantity) },
      { header: 'actif', value: (r) => r.p.isActive && (r.v?.isActive ?? true) },
    ])
  }

  async stockCsv(siteId: string) {
    const lots = await this.prisma.stockLot.findMany({
      where: { siteId, quantity: { gt: 0 } },
      include: { product: { select: { name: true } }, variant: { select: { name: true } } },
      orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }],
    })
    const csv = await this.productsCsv(siteId)
    if (!lots.length) return csv
    // Les lots et pièces numérotées sont détaillés à la suite
    return (
      csv +
      toCsv(lots, [
        { header: 'lot_produit', value: (l) => l.product.name },
        { header: 'lot_variante', value: (l) => l.variant?.name },
        { header: 'numero_lot', value: (l) => l.lotNumber },
        { header: 'numero_serie', value: (l) => l.serialNumber },
        { header: 'date_limite', value: (l) => l.expiresAt?.toISOString().slice(0, 10) },
        { header: 'quantite', value: (l) => n(l.quantity) },
      ]).replace(/^\uFEFF/, '\r\n')
    )
  }

  async clientsCsv(organizationId: string) {
    const clients = await this.prisma.b2BClient.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return toCsv(clients, [
      { header: 'Raison sociale', value: (c) => c.name },
      { header: 'SIRET', value: (c) => c.siret },
      { header: 'N° TVA', value: (c) => c.vatNumber },
      { header: 'E-mail', value: (c) => c.email },
      { header: 'Téléphone', value: (c) => c.phone },
      { header: 'Adresse', value: (c) => c.address },
      { header: 'Code postal', value: (c) => c.zipCode },
      { header: 'Ville', value: (c) => c.city },
      { header: 'Pays', value: (c) => c.country },
      { header: 'Remise %', value: (c) => n(c.discount) },
      { header: 'Délai de paiement (jours)', value: (c) => c.paymentTerms },
    ])
  }

  // Import du catalogue. En aperçu (dryRun), rien n'est écrit.
  async importProducts(siteId: string, csv: string, dryRun: boolean) {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { organization: { select: { taxRates: { where: { isDefault: true }, select: { rate: true } } } } },
    })
    const [existingProducts, existingCategories] = await Promise.all([
      this.prisma.product.findMany({ where: { siteId, isCustom: false }, select: { name: true } }),
      this.prisma.category.findMany({ where: { siteId }, select: { id: true, name: true } }),
    ])
    const plan = planProductImport(parseCsv(csv), {
      existingProductNames: existingProducts.map((p) => p.name),
      existingCategories: existingCategories.map((c) => c.name),
      defaultTaxRate: Number(site.organization.taxRates[0]?.rate ?? 20),
    })

    const summary = {
      dryRun,
      products: plan.products.length,
      variants: plan.products.reduce((a, p) => a + p.variants.length, 0),
      categories: plan.categoriesToCreate,
      errors: plan.errors,
      skipped: plan.skipped,
      preview: plan.products.slice(0, 50).map((p) => ({
        line: p.line,
        name: p.name,
        category: p.category ?? null,
        price: p.price,
        taxRate: p.taxRate,
        variants: p.variants.map((v) => v.name),
      })),
    }
    if (dryRun || plan.errors.length || !plan.products.length) return { ...summary, imported: false }

    await this.prisma.$transaction((tx) => this.applyPlan(tx, siteId, plan, existingCategories), { timeout: 60_000 })
    return { ...summary, imported: true }
  }

  private async applyPlan(
    tx: Prisma.TransactionClient,
    siteId: string,
    plan: ImportPlan,
    existingCategories: Array<{ id: string; name: string }>,
  ) {
    const categoryIds = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]))
    const maxPos = await tx.category.aggregate({ where: { siteId }, _max: { position: true } })
    let position = (maxPos._max.position ?? -1) + 1
    for (const name of plan.categoriesToCreate) {
      const c = await tx.category.create({ data: { siteId, name, position: position++ } })
      categoryIds.set(name.toLowerCase(), c.id)
    }

    for (const p of plan.products) {
      const product = await tx.product.create({
        data: {
          siteId,
          name: p.name,
          subtitle: p.subtitle,
          description: p.description,
          categoryId: p.category ? categoryIds.get(p.category.toLowerCase()) : undefined,
          price: new Decimal(p.price),
          taxRate: new Decimal(p.taxRate),
          sku: p.sku,
          barcode: p.barcode,
          options: { create: p.options.map((o, i) => ({ ...o, position: i })) },
          variants: {
            create: p.variants.map((v, i) => ({
              name: v.name,
              options: v.options,
              price: new Decimal(v.price),
              sku: v.sku,
              barcode: v.barcode,
              position: i,
              ...(v.stock !== null ? { stock: { create: { siteId, quantity: new Decimal(v.stock) } } } : {}),
            })),
          },
          ...(p.stock !== null ? { stockItem: { create: { siteId, quantity: new Decimal(p.stock), unit: 'unité' } } } : {}),
        },
      })
      const received = p.variants.length
        ? p.variants.reduce((a, v) => a + (v.stock ?? 0), 0)
        : p.stock ?? 0
      if (received > 0) {
        await tx.stockMovement.create({
          data: {
            siteId,
            productId: product.id,
            type: 'RESTOCK',
            quantity: new Decimal(received),
            reason: 'Import du catalogue',
          },
        })
      }
    }
  }
}
