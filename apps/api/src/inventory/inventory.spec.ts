import 'reflect-metadata'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { Decimal } from '@prisma/client/runtime/library'
import { Reflector } from '@nestjs/core'
import { Role } from '@erp/types'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { fakeStockDb } from '../stock/stock-db.spec-support'
import { StockService } from '../stock/stock.service'
import { InventoryService } from './inventory.service'
import { InventoryController } from './inventory.controller'
import { CountLineDto } from './inventory.dto'
import { lineGap, summarize } from './inventory-plan'

const SITE = 's1'
const D = (n: number) => new Decimal(n)
const base = { isActive: true, isCustom: false, isGiftCard: false, isMenu: false, soldByWeight: false, tracking: 'NONE' }

const seed = () => ({
  site: [{ id: SITE, organizationId: 'org1', timezone: 'Europe/Paris' }, { id: 's2', organizationId: 'org1', timezone: 'Europe/Paris' }],
  category: [{ id: 'c1', siteId: SITE, name: 'Épicerie' }, { id: 'c2', siteId: SITE, name: 'Cave' }],
  product: [
    { ...base, id: 'p1', siteId: SITE, categoryId: 'c1', name: 'Confiture de figues', sku: 'CF-01', barcode: '3760001' },
    { ...base, id: 'p2', siteId: SITE, categoryId: 'c2', name: 'Vin rouge', sku: 'VR-01', barcode: null },
    { ...base, id: 'p3', siteId: SITE, categoryId: 'c1', name: 'Miel de lavande', sku: 'ML-01', barcode: '3760003' },
    { ...base, id: 'p4', siteId: SITE, categoryId: 'c1', name: 'Fromage en vrac', sku: null, barcode: null, soldByWeight: true },
    // Hors inventaire : formule, produit retiré, produit d'un autre site, article libre
    { ...base, id: 'px1', siteId: SITE, categoryId: 'c1', name: 'Formule dégustation', isMenu: true },
    { ...base, id: 'px2', siteId: SITE, categoryId: 'c1', name: 'Ancien produit', isActive: false },
    { ...base, id: 'px3', siteId: 's2', name: 'Autre boutique' },
    { ...base, id: 'px4', siteId: SITE, name: 'Article libre', isCustom: true },
  ],
  variant: [
    { id: 'v1', productId: 'p2', name: '75 cl', sku: 'VR-75', barcode: '3760075', isActive: true, position: 0 },
    { id: 'v2', productId: 'p2', name: '150 cl', sku: 'VR-150', barcode: '3760150', isActive: true, position: 1 },
  ],
  stockItem: [
    { id: 'si1', productId: 'p1', siteId: SITE, quantity: D(10), unit: 'pot', alertAt: null },
    { id: 'si3', productId: 'p3', siteId: SITE, quantity: D(4), unit: 'unité', alertAt: null },
    { id: 'si4', productId: 'p4', siteId: SITE, quantity: D(2.5), unit: 'kg', alertAt: null },
  ],
  variantStock: [
    { id: 'vs1', variantId: 'v1', siteId: SITE, quantity: D(6), alertAt: null },
  ],
})

function setup() {
  const fake = fakeStockDb(seed())
  const audit = { log: vi.fn(async () => {}) }
  const inventory = new InventoryService(fake.prisma as any, audit as any)
  const stock = new StockService(fake.prisma as any, {} as any, audit as any)
  const ctx = { userId: 'u1', organizationId: 'org1' }
  const lineOf = (db: any, countId: string, productId: string, variantId: string | null = null) =>
    db.inventoryCountLine.find((l: any) => l.countId === countId && l.productId === productId && l.variantId === variantId)
  const stockOf = (db: any, productId: string, variantId: string | null = null) =>
    Number((variantId ? db.variantStock.find((s: any) => s.variantId === variantId) : db.stockItem.find((s: any) => s.productId === productId)).quantity)
  return { ...fake, inventory, stock, audit, ctx, lineOf, stockOf }
}

afterEach(() => vi.useRealTimers())

describe('calculs d’un inventaire', () => {
  it('écart : absent tant que la ligne n’est pas comptée', () => {
    expect(lineGap({ expectedQty: 10, countedQty: null })).toBeNull()
    expect(lineGap({ expectedQty: 10, countedQty: 7 })).toBe(-3)
    expect(lineGap({ expectedQty: 0.1, countedQty: 0.3 })).toBe(0.2)
  })
  it('bilan : comptées, non comptées, écarts, surplus et manquants', () => {
    expect(summarize([
      { expectedQty: 10, countedQty: 7 },
      { expectedQty: 4, countedQty: 6 },
      { expectedQty: 5, countedQty: 5 },
      { expectedQty: 3, countedQty: null },
    ])).toEqual({ total: 4, counted: 3, uncounted: 1, withGap: 2, surplus: 2, missing: -3 })
  })
})

describe('démarrer un inventaire', () => {
  it('instantané du catalogue du site : produits et variantes, sans formule ni produit retiré', async () => {
    const { inventory, ctx } = setup()
    const inv = await inventory.start(SITE, {}, ctx.userId)
    expect(inv.status).toBe('DRAFT')
    expect(inv.openKey).toBe(SITE)
    expect(inv.createdById).toBe('u1')
    const rows = inv.lines.map((l) => [l.name, Number(l.expectedQty), l.unit])
    expect(rows).toEqual([
      ['Confiture de figues', 10, 'pot'],
      ['Fromage en vrac', 2.5, 'kg'],
      ['Miel de lavande', 4, 'unité'],
      ['Vin rouge (150 cl)', 0, 'unité'],
      ['Vin rouge (75 cl)', 6, 'unité'],
    ])
    // Les codes de la variante priment, pour la douchette
    const v75 = inv.lines.find((l) => l.name === 'Vin rouge (75 cl)')!
    expect([v75.sku, v75.barcode, v75.variantId]).toEqual(['VR-75', '3760075', 'v1'])
    expect(inv.summary).toMatchObject({ total: 5, counted: 0, uncounted: 5 })
  })

  it('une catégorie seulement', async () => {
    const { inventory } = setup()
    const inv = await inventory.start(SITE, { categoryId: 'c2' })
    expect(inv.categoryName).toBe('Cave')
    expect(inv.lines.map((l) => l.name)).toEqual(['Vin rouge (150 cl)', 'Vin rouge (75 cl)'])
  })

  it('catégorie d’un autre site : introuvable ; catégorie vide : rien à compter', async () => {
    const { inventory, db } = setup()
    await expect(inventory.start('s2', { categoryId: 'c1' })).rejects.toBeInstanceOf(NotFoundException)
    db.category.push({ id: 'c3', siteId: SITE, name: 'Vide' })
    await expect(inventory.start(SITE, { categoryId: 'c3' })).rejects.toThrow('Aucun produit')
    expect(db.inventoryCount).toHaveLength(0)
  })

  it('un seul inventaire ouvert par site, mais un par site', async () => {
    const { inventory, db } = setup()
    await inventory.start(SITE, {})
    await expect(inventory.start(SITE, {})).rejects.toBeInstanceOf(ConflictException)
    await expect(inventory.start(SITE, { categoryId: 'c1' })).rejects.toThrow('déjà en cours')
    expect(db.inventoryCount).toHaveLength(1)
    // Un autre site a le sien (produit px3)
    await expect(inventory.start('s2', {})).resolves.toMatchObject({ siteId: 's2' })
  })

  it('départ simultané : la clé unique du brouillon refuse le second', async () => {
    const { inventory, prisma, db } = setup()
    // Le second démarrage ne voit pas encore le brouillon du premier
    const find = prisma.inventoryCount.findFirst
    prisma.inventoryCount.findFirst = async (a: any) => (a.where?.status === 'DRAFT' ? null : find(a))
    await inventory.start(SITE, {})
    await expect(inventory.start(SITE, {})).rejects.toThrow('déjà en cours')
    prisma.inventoryCount.findFirst = find
    expect(db.inventoryCount).toHaveLength(1)
    expect(db.inventoryCountLine.length).toBe(5)
  })
})

describe('saisir les quantités', () => {
  it('quantité, motif et note ; remise à « non comptée »', async () => {
    const { inventory, db, lineOf } = setup()
    const inv = await inventory.start(SITE, {})
    const line = lineOf(db, inv.id, 'p1')
    const res = await inventory.countLine(SITE, inv.id, line.id, { countedQty: 8, reasonCode: 'CASSE', note: 'tombés' })
    expect(res.gap).toBe(-2)
    expect(lineOf(db, inv.id, 'p1')).toMatchObject({ reasonCode: 'CASSE', note: 'tombés' })
    const back = await inventory.countLine(SITE, inv.id, line.id, { countedQty: null })
    expect(back.gap).toBeNull()
    expect(db.inventoryCountLine.find((l) => l.id === line.id)!.countedQty).toBeNull()
  })

  it('ligne d’un autre inventaire ou d’un autre site : introuvable', async () => {
    const { inventory, db, lineOf } = setup()
    const inv = await inventory.start(SITE, {})
    const other = await inventory.start('s2', {})
    const line = lineOf(db, inv.id, 'p1')
    await expect(inventory.countLine(SITE, other.id, line.id, { countedQty: 1 })).rejects.toBeInstanceOf(NotFoundException)
    await expect(inventory.countLine(SITE, inv.id, 'inconnue', { countedQty: 1 })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('quantité validée côté serveur : négative et texte refusés', async () => {
    const errors = async (body: object) => (await validate(plainToInstance(CountLineDto, body))).flatMap((e) => Object.keys(e.constraints ?? {}))
    expect(await errors({ countedQty: 3.5 })).toEqual([])
    expect(await errors({ countedQty: null })).toEqual([])
    expect(await errors({ countedQty: -1 })).toContain('min')
    expect(await errors({ countedQty: 'x' })).toContain('isNumber')
    expect(await errors({ reasonCode: 'PERDU' })).toContain('isIn')
    expect(await errors({ reasonCode: 'VOL', note: 'a'.repeat(201) })).toContain('maxLength')
  })
})

describe('valider un inventaire', () => {
  it('écrit les écarts en ADJUSTMENT signés, « Inventaire du jj/mm/aaaa », en une fois', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'))
    const { inventory, db, ctx, lineOf, stockOf, audit } = setup()
    const inv = await inventory.start(SITE, {})
    const set = (pid: string, q: number | null, vid: string | null = null, extra: object = {}) =>
      inventory.countLine(SITE, inv.id, lineOf(db, inv.id, pid, vid).id, { countedQty: q, ...extra })
    await set('p1', 7, null, { reasonCode: 'CASSE' }) // -3
    await set('p3', 9) // +5
    await set('p4', 2.5) // aucun écart
    await set('p2', 6, 'v1') // aucun écart
    await set('p2', 3, 'v2') // +3 sur une variante sans ligne de stock

    const res = await inventory.validate(SITE, inv.id, ctx)
    expect(res.status).toBe('VALIDATED')
    expect(res.validatedById).toBe('u1')
    expect(res.openKey).toBeNull()
    expect(res.adjusted).toBe(3)

    expect([stockOf(db, 'p1'), stockOf(db, 'p3'), stockOf(db, 'p4'), stockOf(db, 'p2', 'v1'), stockOf(db, 'p2', 'v2')]).toEqual([7, 9, 2.5, 6, 3])
    const moves = db.stockMovement.map((m) => ({ pid: m.productId, vid: m.variantId, type: m.type, q: Number(m.quantity), reason: m.reason, count: m.inventoryCountId }))
    expect(moves).toHaveLength(3)
    expect(moves.every((m) => m.type === 'ADJUSTMENT' && m.count === inv.id)).toBe(true)
    expect(moves.find((m) => m.pid === 'p1')).toMatchObject({ q: -3, reason: 'Inventaire du 20/10/2026 (Casse)' })
    expect(moves.find((m) => m.pid === 'p3')).toMatchObject({ q: 5, reason: 'Inventaire du 20/10/2026' })
    expect(moves.find((m) => m.vid === 'v2')).toMatchObject({ q: 3 })
    expect(db.stockMovement.find((m) => m.productId === 'p1')!.reasonCode).toBe('CASSE')

    expect(audit.log).toHaveBeenCalledTimes(1)
    expect((audit.log.mock.calls as any[][])[0][0]).toMatchObject({ action: 'inventory.validated', target: inv.id, organizationId: 'org1' })
  })

  it('les lignes non comptées ne touchent pas au stock', async () => {
    const { inventory, db, ctx, lineOf, stockOf } = setup()
    const inv = await inventory.start(SITE, {})
    await inventory.countLine(SITE, inv.id, lineOf(db, inv.id, 'p1').id, { countedQty: 1 })
    const res = await inventory.validate(SITE, inv.id, ctx)
    expect(res.summary).toMatchObject({ counted: 1, uncounted: 4 })
    expect(stockOf(db, 'p1')).toBe(1)
    expect([stockOf(db, 'p3'), stockOf(db, 'p4')]).toEqual([4, 2.5])
    expect(db.stockMovement).toHaveLength(1)
  })

  it('les ventes faites pendant le comptage ne sont pas effacées', async () => {
    const { inventory, stock, db, ctx, lineOf, stockOf } = setup()
    const inv = await inventory.start(SITE, {}) // attendu : 10
    await inventory.countLine(SITE, inv.id, lineOf(db, inv.id, 'p1').id, { countedQty: 8 }) // écart -2
    await stock.decrementItems({ siteId: SITE, orderId: 'o1', items: [{ productId: 'p1', quantity: 3 }] }) // stock 7
    await inventory.validate(SITE, inv.id, ctx)
    expect(stockOf(db, 'p1')).toBe(5) // 7 - 2, pas 8
    expect(Number(db.stockMovement.at(-1)!.quantity)).toBe(-2)
  })

  it('un écart à la baisse sort aussi des lots, dates proches d’abord', async () => {
    const { inventory, db, ctx, lineOf } = setup()
    db.stockLot.push(
      { id: 'l1', siteId: SITE, productId: 'p1', variantId: null, serialNumber: null, quantity: D(6), expiresAt: new Date('2026-12-01'), receivedAt: new Date('2026-10-01') },
      { id: 'l2', siteId: SITE, productId: 'p1', variantId: null, serialNumber: null, quantity: D(4), expiresAt: new Date('2026-11-01'), receivedAt: new Date('2026-10-02') },
    )
    const inv = await inventory.start(SITE, {})
    await inventory.countLine(SITE, inv.id, lineOf(db, inv.id, 'p1').id, { countedQty: 7 })
    await inventory.validate(SITE, inv.id, ctx)
    expect(db.stockLot.map((l) => [l.id, Number(l.quantity)])).toEqual([['l1', 6], ['l2', 1]])
    expect(db.stockMovement.at(-1)!.lotId).toBe('l2')
  })

  it('verrouillé après validation : plus de saisie, de validation ni d’annulation', async () => {
    const { inventory, db, ctx, lineOf, stockOf } = setup()
    const inv = await inventory.start(SITE, {})
    const line = lineOf(db, inv.id, 'p1')
    await inventory.countLine(SITE, inv.id, line.id, { countedQty: 2 })
    await inventory.validate(SITE, inv.id, ctx)

    await expect(inventory.countLine(SITE, inv.id, line.id, { countedQty: 9 })).rejects.toThrow('Inventaire validé')
    await expect(inventory.validate(SITE, inv.id, ctx)).rejects.toBeInstanceOf(ConflictException)
    await expect(inventory.cancel(SITE, inv.id, ctx)).rejects.toThrow('Inventaire validé')
    expect(Number(lineOf(db, inv.id, 'p1').countedQty)).toBe(2)
    expect(stockOf(db, 'p1')).toBe(2)
    expect(db.stockMovement).toHaveLength(1) // pas de second jeu de mouvements
  })

  it('transaction : un échec au milieu des écritures n’écrit rien et laisse le brouillon', async () => {
    const { inventory, db, ctx, lineOf, stockOf, failOn, audit } = setup()
    const inv = await inventory.start(SITE, {})
    for (const [pid, q] of [['p1', 1], ['p3', 1], ['p4', 1]] as const) {
      await inventory.countLine(SITE, inv.id, lineOf(db, inv.id, pid).id, { countedQty: q })
    }
    failOn('stockMovement', 'create', 1) // le deuxième mouvement échoue
    await expect(inventory.validate(SITE, inv.id, ctx)).rejects.toThrow('panne simulée')

    expect([stockOf(db, 'p1'), stockOf(db, 'p3'), stockOf(db, 'p4')]).toEqual([10, 4, 2.5])
    expect(db.stockMovement).toHaveLength(0)
    expect(db.inventoryCount[0]).toMatchObject({ status: 'DRAFT', openKey: SITE, validatedAt: null })
    expect(audit.log).not.toHaveBeenCalled()
  })

  it('un inventaire d’un autre site est introuvable', async () => {
    const { inventory, ctx } = setup()
    const inv = await inventory.start(SITE, {})
    await expect(inventory.validate('s2', inv.id, ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(inventory.get('s2', inv.id)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('annuler et historique', () => {
  it('annuler un brouillon : stock intact, un nouvel inventaire peut démarrer', async () => {
    const { inventory, db, ctx, lineOf, stockOf, audit } = setup()
    const inv = await inventory.start(SITE, {})
    await inventory.countLine(SITE, inv.id, lineOf(db, inv.id, 'p1').id, { countedQty: 0 })
    const res = await inventory.cancel(SITE, inv.id, ctx)
    expect(res.status).toBe('CANCELLED')
    expect(res.openKey).toBeNull()
    expect(stockOf(db, 'p1')).toBe(10)
    expect(db.stockMovement).toHaveLength(0)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'inventory.cancelled' }))
    await expect(inventory.countLine(SITE, inv.id, lineOf(db, inv.id, 'p1').id, { countedQty: 5 })).rejects.toThrow('Inventaire annulé')
    await expect(inventory.validate(SITE, inv.id, ctx)).rejects.toThrow('Inventaire annulé')
    await expect(inventory.start(SITE, {})).resolves.toMatchObject({ status: 'DRAFT' })
  })

  it('historique avec bilan, brouillon courant', async () => {
    const { inventory, db, ctx, lineOf } = setup()
    const first = await inventory.start(SITE, {})
    await inventory.countLine(SITE, first.id, lineOf(db, first.id, 'p1').id, { countedQty: 7 })
    await inventory.validate(SITE, first.id, ctx)
    expect(await inventory.current(SITE)).toBeNull()
    const second = await inventory.start(SITE, { categoryId: 'c2' })
    expect((await inventory.current(SITE))!.id).toBe(second.id)
    const list = await inventory.list(SITE)
    expect(list.map((i) => i.status).sort()).toEqual(['DRAFT', 'VALIDATED'])
    expect(list.find((i) => i.id === first.id)!.summary).toMatchObject({ total: 5, counted: 1, withGap: 1, missing: -3 })
  })
})

describe('droits : un vendeur consulte, il ne compte pas', () => {
  const guard = new RolesGuard(new Reflector())
  const proto = InventoryController.prototype as any
  const ctx = (handler: Function, role: string) =>
    ({ getHandler: () => handler, getClass: () => InventoryController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) }) as any

  it.each(['start', 'countLine', 'validate', 'cancel'])('%s : titulaire et gérant seulement', (name) => {
    expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toEqual([Role.OWNER, Role.MANAGER])
    expect(guard.canActivate(ctx(proto[name], 'SELLER'))).toBe(false)
    expect(guard.canActivate(ctx(proto[name], 'MANAGER'))).toBe(true)
  })
  it.each(['list', 'current', 'get'])('%s : lecture ouverte', (name) => {
    expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toBeUndefined()
    expect(guard.canActivate(ctx(proto[name], 'SELLER'))).toBe(true)
  })
})
