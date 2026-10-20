import { Decimal } from '@prisma/client/runtime/library'

// Base en mémoire pour les tests du stock et des inventaires. Elle imite
// les appels Prisma utilisés par ces services, et surtout les transactions :
// une erreur dans $transaction remet toutes les tables comme avant.

export type Row = Record<string, any>

const TABLES = [
  'site', 'category', 'product', 'variant', 'stockItem', 'variantStock', 'stockLot',
  'stockMovement', 'inventoryCount', 'inventoryCountLine', 'auditLog',
] as const
type Table = (typeof TABLES)[number]

// Relation d'une table vers une autre : clé étrangère et table cible
const RELATIONS: Record<string, Record<string, [string, Table]>> = {
  inventoryCountLine: { count: ['countId', 'inventoryCount'] },
  variantStock: { variant: ['variantId', 'variant'] },
  variant: { product: ['productId', 'product'] },
  stockItem: { product: ['productId', 'product'] },
}

const isDec = (v: unknown): v is Decimal => v instanceof Decimal
const eq = (a: any, b: any) => (isDec(a) || isDec(b) ? new Decimal(a ?? NaN).eq(new Decimal(b ?? NaN)) : a === b)
const cmp = (a: any, b: any) => (isDec(a) || isDec(b) ? new Decimal(a).cmp(new Decimal(b)) : a < b ? -1 : a > b ? 1 : 0)

export function fakeStockDb(seed: Partial<Record<Table, Row[]>> = {}) {
  let n = 0
  const nextId = (p: string) => `${p}${++n}`
  const db = {} as Record<Table, Row[]>
  for (const t of TABLES) db[t] = [...(seed[t] ?? [])].map((r) => ({ ...r }))
  // Échec à provoquer : { table, op, after } lève à l'appel numéro `after + 1`
  const faults: Array<{ table: Table; op: string; after: number; seen: number }> = []

  function matches(table: string, row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (cond === undefined) return true
      if (key === 'AND') return (cond as Row[]).every((c) => matches(table, row, c))
      if (key === 'OR') return (cond as Row[]).some((c) => matches(table, row, c))
      const rel = RELATIONS[table]?.[key]
      if (rel) {
        const target = db[rel[1]].find((r) => r.id === row[rel[0]])
        return !!target && matches(rel[1], target, cond as Row)
      }
      const v = row[key]
      if (cond === null) return v === null || v === undefined
      if (isDec(cond) || typeof cond !== 'object' || cond instanceof Date) return eq(v, cond)
      const c = cond as Row
      if ('in' in c && !(c.in as any[]).includes(v)) return false
      if ('not' in c && (c.not === null ? v === null || v === undefined : eq(v, c.not))) return false
      if ('gt' in c && !(v != null && cmp(v, c.gt) > 0)) return false
      if ('lte' in c && !(v != null && cmp(v, c.lte) <= 0)) return false
      return true
    })
  }

  function sorted(rows: Row[], orderBy: any) {
    const keys = ([] as any[]).concat(orderBy ?? []).flatMap((o) => Object.entries(o) as Array<[string, any]>)
    if (!keys.length) return rows
    return [...rows].sort((a, b) => {
      for (const [k, dir] of keys) {
        const d = typeof dir === 'string' ? dir : dir.sort
        const c = a[k] == null && b[k] == null ? 0 : a[k] == null ? 1 : b[k] == null ? -1 : cmp(a[k], b[k])
        if (c) return d === 'desc' ? -c : c
      }
      return 0
    })
  }

  function model(table: Table, defaults: () => Row = () => ({}), view: (r: Row) => Row = (r) => r) {
    const guard = (op: string) => {
      for (const f of faults) {
        if (f.table === table && f.op === op && f.seen++ >= f.after) throw new Error(`panne simulée : ${table}.${op}`)
      }
    }
    const make = (data: Row) => {
      const row = { id: nextId(table), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data }
      db[table].push(row)
      return row
    }
    return {
      findMany: async (a: Row = {}) => {
        const rows = sorted(db[table].filter((r) => matches(table, r, a.where)), a.orderBy)
        return (a.take ? rows.slice(0, a.take) : rows).map(view)
      },
      findFirst: async (a: Row = {}) => {
        const r = sorted(db[table].filter((x) => matches(table, x, a.where)), a.orderBy)[0]
        return r ? view(r) : null
      },
      findUnique: async (a: Row) => {
        const w = a.where
        const r = db[table].find((x) => Object.entries(w).every(([k, v]) => eq(x[k], v)))
        return r ? view(r) : null
      },
      findUniqueOrThrow: async (a: Row) => {
        const r = db[table].find((x) => Object.entries(a.where).every(([k, v]) => eq(x[k], v)))
        if (!r) throw new Error(`${table} introuvable`)
        return view(r)
      },
      create: async ({ data }: Row) => {
        guard('create')
        return view(make(data))
      },
      createMany: async ({ data }: Row) => {
        guard('createMany')
        for (const d of data) make(d)
        return { count: data.length }
      },
      updateMany: async ({ where, data }: Row) => {
        guard('updateMany')
        const rows = db[table].filter((r) => matches(table, r, where))
        for (const r of rows) Object.assign(r, data, { updatedAt: new Date() })
        return { count: rows.length }
      },
      update: async ({ where, data }: Row) => {
        guard('update')
        const r = db[table].find((x) => Object.entries(where).every(([k, v]) => eq(x[k], v)))
        if (!r) throw new Error(`${table} introuvable`)
        Object.assign(r, data, { updatedAt: new Date() })
        return view(r)
      },
      upsert: async ({ where, update, create }: Row) => {
        guard('upsert')
        const r = db[table].find((x) => Object.entries(where).every(([k, v]) => eq(x[k], v)))
        if (r) return view(Object.assign(r, update, { updatedAt: new Date() }))
        return view(make(create))
      },
    }
  }

  const productView = (p: Row) => {
    const variants = db.variant
      .filter((v) => v.productId === p.id && v.isActive !== false)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((v) => ({ ...v, stock: db.variantStock.find((s) => s.variantId === v.id) ?? null }))
    return { ...p, variants, stockItem: db.stockItem.find((s) => s.productId === p.id) ?? null, options: [], modifierGroups: [], menuSteps: [], allergens: [], category: null }
  }

  const productModel = model('product', () => ({ isActive: true, isCustom: false, isGiftCard: false, isMenu: false, soldByWeight: false, tracking: 'NONE' }), productView)
  const product = {
    ...productModel,
    // Création imbriquée : variantes (avec leur stock) et ligne de stock
    create: async ({ data }: Row) => {
      const { variants, stockItem, options, modifierGroups, menuSteps, ...rest } = data
      const row: Row = { id: nextId('product'), isActive: true, isCustom: false, isGiftCard: false, isMenu: false, soldByWeight: false, ...rest }
      db.product.push(row)
      for (const v of variants?.create ?? []) {
        const { stock, ...vd } = v
        const vr = { id: nextId('variant'), isActive: true, productId: row.id, ...vd }
        db.variant.push(vr)
        if (stock?.create) db.variantStock.push({ id: nextId('variantStock'), variantId: vr.id, alertAt: null, ...stock.create })
      }
      if (stockItem?.create) db.stockItem.push({ id: nextId('stockItem'), alertAt: null, productId: row.id, ...stockItem.create })
      return productView(row)
    },
  }

  const stockItem = model('stockItem', () => ({ unit: 'unité', alertAt: null }), (r) => ({ ...r, product: db.product.find((p) => p.id === r.productId) }))
  const variantStock = model('variantStock', () => ({ alertAt: null }), (r) => {
    const variant = db.variant.find((v) => v.id === r.variantId)
    return { ...r, variant: variant ? { ...variant, product: db.product.find((p) => p.id === variant.productId) } : undefined }
  })
  const inventoryCount = model('inventoryCount', () => ({ status: 'DRAFT', openKey: null, validatedAt: null, cancelledAt: null }), (r) => ({
    ...r,
    lines: db.inventoryCountLine.filter((l) => l.countId === r.id).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id)),
  }))
  const inventoryCountCreate = inventoryCount.create
  inventoryCount.create = async (a: Row) => {
    // Clé unique du brouillon : deux inventaires ouverts sur un site sont refusés
    if (a.data.openKey && db.inventoryCount.some((c) => c.openKey === a.data.openKey)) {
      const err: any = new Error('Unique constraint failed on openKey')
      err.code = 'P2002'
      Object.setPrototypeOf(err, (await import('@prisma/client')).Prisma.PrismaClientKnownRequestError.prototype)
      err.clientVersion = 'test'
      throw err
    }
    return inventoryCountCreate(a)
  }

  const prisma: Row = {
    site: model('site'),
    category: model('category'),
    product,
    variant: model('variant', () => ({ isActive: true })),
    stockItem,
    variantStock,
    stockLot: model('stockLot'),
    stockMovement: model('stockMovement'),
    inventoryCount,
    inventoryCountLine: model('inventoryCountLine', () => ({ countedQty: null, reasonCode: null, note: null })),
    auditLog: model('auditLog'),
    $transaction: async (fn: any) => {
      if (typeof fn !== 'function') return Promise.all(fn)
      const before = Object.fromEntries(TABLES.map((t) => [t, db[t].map((r) => ({ ...r }))])) as Record<Table, Row[]>
      try {
        return await fn(prisma)
      } catch (e) {
        for (const t of TABLES) db[t] = before[t]
        throw e
      }
    },
  }
  // Les tables sont remplacées au retour arrière : on les relit toujours par db[t]
  return {
    db: new Proxy({} as Record<Table, Row[]>, { get: (_, t: string) => db[t as Table] }),
    prisma,
    failOn: (table: Table, op: string, after = 0) => faults.push({ table, op, after, seen: 0 }),
  }
}
