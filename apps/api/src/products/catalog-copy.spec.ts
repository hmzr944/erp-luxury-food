import { describe, it, expect } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { CatalogCopyService } from './catalog-copy.service'

// Base en mémoire : seuls les modèles du catalogue existent. Toucher au stock,
// aux mouvements, aux lots, aux ventes ou aux clients fait échouer le test.
type Row = Record<string, any>

function fakePrisma(seed: { sites: Row[]; categories?: Row[]; groups?: Row[]; products?: Row[] }) {
  let n = 0
  const id = (p: string) => `${p}${++n}`
  const db = {
    sites: seed.sites,
    categories: [...(seed.categories ?? [])],
    groups: [...(seed.groups ?? [])],
    products: [...(seed.products ?? [])],
  }
  const productView = (p: Row) => ({
    ...p,
    variants: (p.variants ?? []).filter((v: Row) => v.isActive !== false),
    options: p.options ?? [],
    modifierGroups: p.modifierGroups ?? [],
    menuSteps: p.menuSteps ?? [],
  })
  const models: Record<string, any> = {
    site: {
      findMany: async ({ where }: any) => db.sites.filter((s) => where.id.in.includes(s.id) && s.organizationId === where.organizationId),
    },
    category: {
      findMany: async ({ where }: any) => db.categories.filter((c) => c.siteId === where.siteId),
      create: async ({ data }: any) => {
        const row = { id: id('cat'), ...data }
        db.categories.push(row)
        return row
      },
    },
    modifierGroup: {
      findMany: async ({ where }: any) => db.groups.filter((g) => g.siteId === where.siteId),
      aggregate: async ({ where }: any) => ({ _max: { position: Math.max(0, ...db.groups.filter((g) => g.siteId === where.siteId).map((g) => g.position ?? 0)) } }),
      create: async ({ data }: any) => {
        const row = { id: id('grp'), ...data, modifiers: data.modifiers.create }
        db.groups.push(row)
        return row
      },
    },
    product: {
      findMany: async ({ where }: any) =>
        db.products
          .filter((p) => p.siteId === where.siteId && (where.isActive === undefined || p.isActive === where.isActive) && (where.isCustom === undefined || !!p.isCustom === where.isCustom))
          .map(productView),
      create: async ({ data }: any) => {
        const variants = (data.variants?.create ?? []).map((v: Row) => ({ id: id('var'), isActive: true, ...v }))
        const row = {
          id: id('prd'),
          isActive: true,
          isSample: false,
          ...data,
          variants,
          options: data.options?.create ?? [],
          modifierGroups: data.modifierGroups?.create ?? [],
          menuSteps: (data.menuSteps?.create ?? []).map((s: Row) => ({ ...s, choices: s.choices.create })),
        }
        db.products.push(row)
        return { id: row.id, variants: variants.map((v: Row) => ({ id: v.id, position: v.position })) }
      },
    },
  }
  const prisma: any = new Proxy(
    { ...models, $transaction: async (fn: any) => fn(prisma) },
    {
      get(target: any, key: string) {
        if (key in target) return target[key]
        if (typeof key === 'symbol' || key === 'then') return undefined
        throw new Error(`Le catalogue ne doit jamais toucher à « ${key} »`)
      },
    },
  )
  return { prisma, db }
}

const sites = [
  { id: 'A', organizationId: 'org1' },
  { id: 'B', organizationId: 'org1' },
  { id: 'X', organizationId: 'org2' },
]

const source = () => ({
  sites,
  categories: [
    { id: 'c1', siteId: 'A', name: 'Chocolats', color: '#111', position: 0 },
    { id: 'c2', siteId: 'A', name: 'Boissons', color: '#222', position: 1 },
  ],
  groups: [
    {
      id: 'g1', siteId: 'A', name: 'Cuisson', minSelect: 1, maxSelect: 1, position: 1, isActive: true,
      modifiers: [{ name: 'Saignant', price: 0, position: 0 }, { name: 'À point', price: 0, position: 1 }],
    },
  ],
  products: [
    {
      id: 'p1', siteId: 'A', name: 'Tablette 72 %', sku: 'TAB72', barcode: '3000000000017', price: 4.5, taxRate: 5.5, categoryId: 'c1',
      tracking: 'LOT_EXPIRY', isActive: true, soldByWeight: false, isMenu: false, createdAt: 1,
      variants: [{ id: 'v1', name: '100 g', price: 4.5, barcode: '3000000000024', sku: 'T72-100', options: {}, position: 0, isActive: true }],
      options: [{ name: 'Format', values: ['100 g'], position: 0 }],
      modifierGroups: [{ productId: 'p1', groupId: 'g1', position: 0 }],
      stockItem: { quantity: 42 },
    },
    { id: 'p2', siteId: 'A', name: 'Fromage', sku: null, barcode: null, price: 24, taxRate: 5.5, categoryId: 'c2', tracking: 'NONE', isActive: true, soldByWeight: true, isMenu: false, createdAt: 2, variants: [] },
    { id: 'p3', siteId: 'A', name: 'Exemple', sku: null, barcode: null, price: 1, taxRate: 10, categoryId: null, tracking: 'NONE', isActive: true, isSample: true, createdAt: 3, variants: [] },
    {
      id: 'p4', siteId: 'A', name: 'Formule midi', sku: null, barcode: null, price: 12, taxRate: 10, categoryId: 'c2', tracking: 'NONE', isActive: true, isMenu: true, createdAt: 4, variants: [],
      menuSteps: [{ name: 'Plat', minSelect: 1, maxSelect: 1, position: 0, choices: [{ productId: 'p1', variantId: 'v1', supplement: 0, position: 0 }] }],
    },
    { id: 'p5', siteId: 'A', name: 'Inactif', price: 1, taxRate: 10, isActive: false, createdAt: 5, variants: [] },
  ],
})

describe('CatalogCopyService', () => {
  it('copie le catalogue complet sans stock et sans exemples', async () => {
    const { prisma, db } = fakePrisma(source())
    const report = await new CatalogCopyService(prisma).copy('B', 'A', 'org1')
    const target = db.products.filter((p) => p.siteId === 'B')
    expect(target.map((p) => p.name).sort()).toEqual(['Formule midi', 'Fromage', 'Tablette 72 %'])
    const tab = target.find((p) => p.name === 'Tablette 72 %')!
    expect(tab).toMatchObject({ sku: 'TAB72', barcode: '3000000000017', price: 4.5, taxRate: 5.5, tracking: 'LOT_EXPIRY' })
    expect(tab.variants).toHaveLength(1)
    expect(tab.variants[0]).toMatchObject({ name: '100 g', barcode: '3000000000024' })
    expect(tab.options[0]).toMatchObject({ name: 'Format', values: ['100 g'] })
    expect(target.find((p) => p.name === 'Fromage')!.soldByWeight).toBe(true)
    // Rayons et groupes recréés sur la cible, produits rattachés aux nouveaux identifiants
    const catB = db.categories.filter((c) => c.siteId === 'B')
    expect(catB.map((c) => c.name)).toEqual(['Chocolats', 'Boissons'])
    expect(tab.categoryId).toBe(catB[0].id)
    const grpB = db.groups.find((g) => g.siteId === 'B')!
    expect(tab.modifierGroups[0].groupId).toBe(grpB.id)
    expect(grpB.modifiers).toHaveLength(2)
    // Formule : étape rebranchée sur l'article et la variante de la cible
    const menu = target.find((p) => p.name === 'Formule midi')!
    expect(menu.menuSteps[0].choices[0]).toMatchObject({ productId: tab.id, variantId: tab.variants[0].id })
    expect(report).toMatchObject({ categories: 2, modifierGroups: 1, products: 3, variants: 1, menus: 1, skipped: 0, samplesExcluded: 1 })
  })

  it('ne copie ni stock, ni lots, ni mouvements, ni ventes, ni clients', async () => {
    const { prisma, db } = fakePrisma(source())
    await new CatalogCopyService(prisma).copy('B', 'A', 'org1')
    for (const p of db.products.filter((x) => x.siteId === 'B')) {
      expect(p.stockItem).toBeUndefined()
      expect(p.lots).toBeUndefined()
    }
    // Le proxy lève dès qu'un autre modèle (stockItem, stockMovement, stockLot, order, customer...) est touché
    expect(() => prisma.stockItem).toThrow(/stockItem/)
    expect(() => prisma.order).toThrow()
  })

  it('est idempotente : un second passage ne duplique rien et le dit', async () => {
    const { prisma, db } = fakePrisma(source())
    const svc = new CatalogCopyService(prisma)
    await svc.copy('B', 'A', 'org1')
    const before = db.products.filter((p) => p.siteId === 'B').length
    const again = await svc.copy('B', 'A', 'org1')
    expect(db.products.filter((p) => p.siteId === 'B')).toHaveLength(before)
    expect(db.categories.filter((c) => c.siteId === 'B')).toHaveLength(2)
    expect(db.groups.filter((g) => g.siteId === 'B')).toHaveLength(1)
    expect(again).toMatchObject({ categories: 0, modifierGroups: 0, products: 0, skipped: 3 })
    expect(again.skippedItems.find((i) => i.name === 'Tablette 72 %')?.reason).toBe('sku')
  })

  it('ignore un article de même code-barres ou de même nom déjà dans la cible', async () => {
    const seed = source()
    seed.products.push(
      { id: 'q1', siteId: 'B', name: 'Autre nom', sku: null, barcode: '3000000000017', price: 9, taxRate: 5.5, isActive: true, variants: [] } as any,
      { id: 'q2', siteId: 'B', name: ' fromage ', sku: null, barcode: null, price: 9, taxRate: 5.5, isActive: true, variants: [] } as any,
    )
    const { prisma, db } = fakePrisma(seed)
    const report = await new CatalogCopyService(prisma).copy('B', 'A', 'org1')
    expect(report.skippedItems).toEqual([
      { name: 'Tablette 72 %', reason: 'barcode' },
      { name: 'Fromage', reason: 'name' },
    ])
    expect(report.products).toBe(1)
    expect(db.products.find((p) => p.id === 'q1')!.price).toBe(9)
    // La formule se rebranche sur l'article déjà présent
    const menu = db.products.find((p) => p.siteId === 'B' && p.name === 'Formule midi')!
    expect(menu.menuSteps[0].choices[0].productId).toBe('q1')
  })

  it('refuse une copie entre organisations différentes ou vers le même site', async () => {
    const { prisma, db } = fakePrisma(source())
    const svc = new CatalogCopyService(prisma)
    await expect(svc.copy('B', 'X', 'org1')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.copy('X', 'A', 'org1')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.copy('A', 'A', 'org1')).rejects.toBeInstanceOf(BadRequestException)
    expect(db.products.filter((p) => p.siteId !== 'A')).toHaveLength(0)
  })

  it('traite un grand catalogue par lots', async () => {
    const seed = source()
    seed.products = Array.from({ length: 250 }, (_, i) => ({
      id: `m${i}`, siteId: 'A', name: `Article ${i}`, sku: `S${i}`, barcode: null, price: 1, taxRate: 5.5, isActive: true, createdAt: i, variants: [],
    })) as any
    const { prisma, db } = fakePrisma(seed)
    let transactions = 0
    const inner = prisma.$transaction
    prisma.$transaction = (fn: any) => (transactions++, inner(fn))
    const report = await new CatalogCopyService(prisma).copy('B', 'A', 'org1')
    expect(report.products).toBe(250)
    expect(db.products.filter((p) => p.siteId === 'B')).toHaveLength(250)
    expect(transactions).toBe(1 + 3)
  })
})
