import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { BadRequestException, ConflictException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { Decimal } from '@prisma/client/runtime/library'
import { Role } from '@erp/types'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { Reflector } from '@nestjs/core'
import { ProductsService } from '../products/products.service'
import { CreateProductDto, UpdateProductDto } from '../products/dto/product.dto'
import { StockService } from './stock.service'
import { StockController, CorrectionDto, ItemSettingsDto, MovementDto } from './stock.controller'
import { StockNetworkService } from './stock-network.service'
import { movementDelta, gap } from './stock-rules'
import { fakeStockDb } from './stock-db.spec-support'

const SITE = 's1'
const seed = () => ({
  site: [{ id: SITE, organizationId: 'org1', timezone: 'Europe/Paris' }],
  product: [
    { id: 'p1', siteId: SITE, isActive: true, isCustom: false, isGiftCard: false, name: 'Confiture de figues', sku: 'CF-01', barcode: '3760001', tracking: 'NONE' },
    { id: 'p2', siteId: SITE, isActive: true, isCustom: false, isGiftCard: false, name: 'Vin rouge', sku: 'VR-01', barcode: '3760002', tracking: 'NONE' },
  ],
  variant: [
    { id: 'v1', productId: 'p2', name: '75 cl', isActive: true, position: 0 },
    { id: 'v2', productId: 'p2', name: '150 cl', isActive: true, position: 1 },
  ],
  stockItem: [{ id: 'si1', productId: 'p1', siteId: SITE, quantity: new Decimal(10), unit: 'unité', alertAt: null }],
  variantStock: [{ id: 'vs1', variantId: 'v1', siteId: SITE, quantity: new Decimal(6), alertAt: null }],
})

function setup() {
  const fake = fakeStockDb(seed())
  const audit = { log: vi.fn(async () => {}) }
  const service = new StockService(fake.prisma as any, {} as any, audit as any)
  return { ...fake, service, stock: service, audit }
}
const qty = (db: any, id = 'p1') => Number(db.stockItem.find((s: any) => s.productId === id).quantity)

describe('delta d’un mouvement', () => {
  it('les sorties baissent, les entrées montent, l’ajustement suit son signe', () => {
    expect(movementDelta('SALE', 3)).toBe(-3)
    expect(movementDelta('LOSS', 3)).toBe(-3)
    expect(movementDelta('TRANSFER', -3)).toBe(-3)
    expect(movementDelta('RESTOCK', 3)).toBe(3)
    expect(movementDelta('ADJUSTMENT', 3)).toBe(3)
    expect(movementDelta('ADJUSTMENT', -3)).toBe(-3)
  })
  it('l’écart se calcule sans bruit de virgule', () => {
    expect(gap(0.3, 0.1)).toBe(0.2)
    expect(gap(7, 10)).toBe(-3)
  })
})

describe('corriger le stock', () => {
  it('à la baisse : mouvement ADJUSTMENT négatif et quantité fixée au comptage', async () => {
    const { service, db } = setup()
    const res = await service.correct({
      siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 7, reasonCode: 'CASSE', note: 'bocaux tombés', userId: 'u1',
    })
    expect(qty(db)).toBe(7)
    expect(Number(res.delta)).toBe(-3)
    const mv = db.stockMovement.at(-1)!
    expect(mv.type).toBe('ADJUSTMENT')
    expect(Number(mv.quantity)).toBe(-3)
    expect(mv.reasonCode).toBe('CASSE')
    expect(mv.reason).toBe('Correction : Casse : bocaux tombés')
    expect(mv.userId).toBe('u1')
  })

  it('à la hausse : mouvement positif', async () => {
    const { service, db } = setup()
    await service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 12, reasonCode: 'ERREUR_SAISIE' })
    expect(qty(db)).toBe(12)
    expect(Number(db.stockMovement.at(-1)!.quantity)).toBe(2)
  })

  it('la variante se corrige seule ; un produit à variantes exige la variante', async () => {
    const { service, db } = setup()
    await service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p2', variantId: 'v1', countedQuantity: 4, reasonCode: 'VOL' })
    expect(Number(db.variantStock.find((s) => s.variantId === 'v1')!.quantity)).toBe(4)
    await expect(service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p2', countedQuantity: 1, reasonCode: 'VOL' })).rejects.toThrow('variante')
  })

  it('refuse une quantité identique, négative, un motif « autre » sans précision', async () => {
    const { service, db } = setup()
    const base = { siteId: SITE, organizationId: 'org1', productId: 'p1' }
    await expect(service.correct({ ...base, countedQuantity: 10, reasonCode: 'CASSE' })).rejects.toThrow('rien à corriger')
    await expect(service.correct({ ...base, countedQuantity: -1, reasonCode: 'CASSE' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.correct({ ...base, countedQuantity: 5, reasonCode: 'AUTRE' })).rejects.toThrow('Précisez')
    await expect(service.correct({ ...base, countedQuantity: 5, reasonCode: 'PERDU' as any })).rejects.toThrow('Motif')
    expect(qty(db)).toBe(10)
    expect(db.stockMovement).toHaveLength(0)
  })

  it('un produit d’un autre site est introuvable', async () => {
    const { service } = setup()
    await expect(service.correct({ siteId: 'autre', organizationId: 'org1', productId: 'p1', countedQuantity: 1, reasonCode: 'CASSE' })).rejects.toThrow('introuvable')
  })

  it('journal d’audit de la correction', async () => {
    const { service, audit } = setup()
    await service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 7, reasonCode: 'DON', userId: 'u1' })
    expect(audit.log).toHaveBeenCalledTimes(1)
    const entry = (audit.log.mock.calls as any[][])[0][0]
    expect(entry).toMatchObject({ organizationId: 'org1', userId: 'u1', action: 'stock.correction', target: 'p1' })
    expect(entry.detail).toContain('Confiture de figues : 10 vers 7 (-3)')
    expect(entry.detail).toContain('Don')
  })

  it('la vente continue de baisser le stock après une correction', async () => {
    const { service, db } = setup()
    await service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 8, reasonCode: 'CASSE' })
    await service.decrementItems({ siteId: SITE, orderId: 'o1', items: [{ productId: 'p1', quantity: 3 }] })
    expect(qty(db)).toBe(5)
    expect(db.stockMovement.map((m) => m.type)).toEqual(['ADJUSTMENT', 'SALE'])
  })
})

describe('transaction : un échec n’écrit rien', () => {
  it('correction : mouvement en échec, la quantité reste', async () => {
    const { service, db, failOn, audit } = setup()
    failOn('stockMovement', 'create')
    await expect(service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 2, reasonCode: 'CASSE' })).rejects.toThrow('panne simulée')
    expect(qty(db)).toBe(10)
    expect(db.stockMovement).toHaveLength(0)
    expect(audit.log).not.toHaveBeenCalled()
  })

  it('perte : quantité écrite puis mouvement en échec, tout est annulé', async () => {
    const { service, db, failOn } = setup()
    failOn('stockMovement', 'create')
    await expect(service.addMovement({ siteId: SITE, productId: 'p1', type: 'LOSS', quantity: 4 })).rejects.toThrow('panne simulée')
    expect(qty(db)).toBe(10)
  })

  it('une vente passée entre la lecture et l’écriture n’est pas écrasée', async () => {
    const { service, db, prisma } = setup()
    // Une vente décrémente le stock au moment où la correction écrit
    const real = prisma.stockItem.updateMany
    prisma.stockItem.updateMany = async (a: any) => {
      db.stockItem.find((s) => s.productId === 'p1')!.quantity = new Decimal(9)
      return real(a)
    }
    await expect(service.correct({ siteId: SITE, organizationId: 'org1', productId: 'p1', countedQuantity: 5, reasonCode: 'CASSE' })).rejects.toBeInstanceOf(ConflictException)
    expect(db.stockMovement).toHaveLength(0)
  })
})

describe('réception et perte', () => {
  it('réception : entrée ; perte : sortie, jamais au-delà du stock', async () => {
    const { service, db } = setup()
    await service.addMovement({ siteId: SITE, productId: 'p1', type: 'RESTOCK', quantity: 5, reason: 'Livraison' })
    expect(qty(db)).toBe(15)
    await service.addMovement({ siteId: SITE, productId: 'p1', type: 'LOSS', quantity: 4, reason: 'Périmé' })
    expect(qty(db)).toBe(11)
    await expect(service.addMovement({ siteId: SITE, productId: 'p1', type: 'LOSS', quantity: 50 })).rejects.toThrow('supérieure au stock')
    expect(qty(db)).toBe(11)
    expect(db.stockMovement.map((m) => [m.type, Number(m.quantity)])).toEqual([['RESTOCK', 5], ['LOSS', 4]])
  })

  it('refuse zéro, négatif ; produit suivi par lot : passer par les lots', async () => {
    const { service, db } = setup()
    await expect(service.addMovement({ siteId: SITE, productId: 'p1', type: 'RESTOCK', quantity: 0 })).rejects.toThrow('supérieure à zéro')
    await expect(service.addMovement({ siteId: SITE, productId: 'p1', type: 'LOSS', quantity: -2 })).rejects.toThrow('supérieure à zéro')
    db.product[0].tracking = 'LOT_EXPIRY'
    await expect(service.addMovement({ siteId: SITE, productId: 'p1', type: 'RESTOCK', quantity: 1 })).rejects.toThrow('Lots et dates')
  })

  it('une perte sort d’abord le lot le plus proche de sa date', async () => {
    const { service, db } = setup()
    db.stockLot.push(
      { id: 'l1', siteId: SITE, productId: 'p1', variantId: null, serialNumber: null, quantity: new Decimal(4), expiresAt: new Date('2026-12-01'), receivedAt: new Date('2026-10-01') },
      { id: 'l2', siteId: SITE, productId: 'p1', variantId: null, serialNumber: null, quantity: new Decimal(6), expiresAt: new Date('2026-11-01'), receivedAt: new Date('2026-10-02') },
    )
    await service.addMovement({ siteId: SITE, productId: 'p1', type: 'LOSS', quantity: 7 })
    expect(db.stockLot.map((l) => [l.id, Number(l.quantity)])).toEqual([['l1', 3], ['l2', 0]])
  })
})

describe('validation des données saisies', () => {
  const errors = async (cls: any, body: object) => (await validate(plainToInstance(cls, body))).flatMap((e) => Object.keys(e.constraints ?? {}))
  it('mouvement : type limité à réception et perte, quantité positive', async () => {
    expect(await errors(MovementDto, { productId: 'p1', type: 'RESTOCK', quantity: 2 })).toEqual([])
    expect(await errors(MovementDto, { productId: 'p1', type: 'ADJUSTMENT', quantity: 2 })).toContain('isIn')
    expect(await errors(MovementDto, { productId: 'p1', type: 'SALE', quantity: 2 })).toContain('isIn')
    expect(await errors(MovementDto, { productId: 'p1', type: 'LOSS', quantity: -2 })).toContain('min')
    expect(await errors(MovementDto, { productId: 'p1', type: 'LOSS', quantity: 'beaucoup' })).toContain('isNumber')
    expect(await errors(MovementDto, { type: 'LOSS', quantity: 1 })).toContain('isString')
  })
  it('correction : quantité comptée positive ou nulle, motif obligatoire dans la liste', async () => {
    expect(await errors(CorrectionDto, { productId: 'p1', countedQuantity: 0, reasonCode: 'VOL' })).toEqual([])
    expect(await errors(CorrectionDto, { productId: 'p1', countedQuantity: -1, reasonCode: 'VOL' })).toContain('min')
    expect(await errors(CorrectionDto, { productId: 'p1', countedQuantity: 3 })).toContain('isIn')
    expect(await errors(CorrectionDto, { productId: 'p1', countedQuantity: 3, reasonCode: 'COUP_DE_COEUR' })).toContain('isIn')
  })
  it('seuil : positif, null accepté pour l’effacer', async () => {
    expect(await errors(ItemSettingsDto, { alertAt: 5 })).toEqual([])
    expect(await errors(ItemSettingsDto, { alertAt: null })).toEqual([])
    expect(await errors(ItemSettingsDto, { alertAt: -1 })).toContain('min')
    expect(await errors(UpdateProductDto, { alertAt: -2 })).toContain('min')
    expect(await errors(CreateProductDto, { name: 'x', price: 1, alertAt: 2.5 })).toEqual([])
    expect(await errors(CreateProductDto, { name: 'x', price: 1, alertAt: 'bas' })).toContain('isNumber')
  })
})

describe('droits : un vendeur consulte, il ne saisit pas', () => {
  const guard = new RolesGuard(new Reflector())
  const ctx = (handler: Function, role: string) =>
    ({ getHandler: () => handler, getClass: () => StockController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) }) as any
  const proto = StockController.prototype as any

  it.each(['addMovement', 'correct', 'updateItem', 'receiveLot'])('%s : titulaire et gérant seulement', (name) => {
    expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toEqual([Role.OWNER, Role.MANAGER])
    expect(guard.canActivate(ctx(proto[name], 'SELLER'))).toBe(false)
    expect(guard.canActivate(ctx(proto[name], 'PRODUCTION'))).toBe(false)
    expect(guard.canActivate(ctx(proto[name], 'MANAGER'))).toBe(true)
    expect(guard.canActivate(ctx(proto[name], 'OWNER'))).toBe(true)
  })

  it.each(['getInventory', 'getAlerts', 'getMovements', 'getLots'])('%s : ouvert à la consultation', (name) => {
    expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toBeUndefined()
    expect(guard.canActivate(ctx(proto[name], 'SELLER'))).toBe(true)
  })
})

describe('seuil d’alerte : du produit aux alertes', () => {
  const fullSetup = () => {
    const fake = fakeStockDb({
      ...seed(),
      stockItem: [],
      variantStock: [],
    })
    fake.prisma.site.findUniqueOrThrow = async () => ({ organization: { id: 'org1', sector: 'GENERAL', taxRates: [{ rate: 5.5 }] } })
    fake.prisma.attributeDefinition = { findMany: async () => [] }
    fake.prisma.organization = { findUnique: async () => ({ packs: [] }) }
    const products = new ProductsService(fake.prisma as any)
    const stock = new StockService(fake.prisma as any, {} as any, { log: async () => {} } as any)
    return { ...fake, products, stock }
  }

  it('créer un produit avec seuil crée sa ligne de stock ; l’alerte se déclenche sous le seuil', async () => {
    const { products, stock, db } = fullSetup()
    const created = await products.create(SITE, { name: 'Huile d’olive', price: 12, alertAt: 5 } as any)
    expect(Number(db.stockItem.find((s) => s.productId === created.id)!.alertAt)).toBe(5)
    // Stock à zéro, sous le seuil : alerte
    expect((await stock.getLowStockAlerts(SITE)).map((a) => a.product.name)).toEqual(['Huile d’olive'])
    await stock.addMovement({ siteId: SITE, productId: created.id, type: 'RESTOCK', quantity: 20 })
    expect(await stock.getLowStockAlerts(SITE)).toEqual([])
    await stock.addMovement({ siteId: SITE, productId: created.id, type: 'LOSS', quantity: 15 })
    // 5 sur 5 : au seuil, alerte
    expect(await stock.getLowStockAlerts(SITE)).toHaveLength(1)
  })

  it('sans seuil, aucune alerte', async () => {
    const { products, stock } = fullSetup()
    await products.create(SITE, { name: 'Sel', price: 2 } as any)
    expect(await stock.getLowStockAlerts(SITE)).toEqual([])
  })

  it('modifier le produit pose, change puis efface le seuil', async () => {
    const { products, stock, db } = fullSetup()
    const p = await products.create(SITE, { name: 'Sel', price: 2 } as any)
    await products.update(p.id, SITE, { alertAt: 3 } as any)
    expect(Number(db.stockItem.find((s) => s.productId === p.id)!.alertAt)).toBe(3)
    expect(await stock.getLowStockAlerts(SITE)).toHaveLength(1)
    await products.update(p.id, SITE, { alertAt: 8 } as any)
    expect(Number(db.stockItem.find((s) => s.productId === p.id)!.alertAt)).toBe(8)
    await products.update(p.id, SITE, { alertAt: null } as any)
    expect(db.stockItem.find((s) => s.productId === p.id)!.alertAt).toBeNull()
    expect(await stock.getLowStockAlerts(SITE)).toEqual([])
  })

  it('un produit à variantes porte le seuil sur chaque variante', async () => {
    const { products, stock, db } = fullSetup()
    const p = await products.create(SITE, { name: 'Vin', price: 10, alertAt: 2, options: [{ name: 'Contenance', values: ['75 cl', '150 cl'] }] } as any)
    const vs = db.variantStock.filter((s) => db.variant.find((v) => v.id === s.variantId)!.productId === p.id)
    expect(vs).toHaveLength(2)
    expect(vs.every((s) => Number(s.alertAt) === 2)).toBe(true)
    expect((await stock.getLowStockAlerts(SITE)).map((a) => a.variantName).sort()).toEqual(['150 cl', '75 cl'])
  })

  it('depuis l’écran de stock : le seuil se pose sur une ligne existante ou à créer', async () => {
    const { stock, db } = setup()
    await stock.updateItemSettings(SITE, 'p1', { alertAt: 12 })
    expect(await stock.getLowStockAlerts(SITE)).toHaveLength(1)
    await stock.updateItemSettings(SITE, 'p1', { alertAt: 4, unit: 'pot' })
    expect(await stock.getLowStockAlerts(SITE)).toEqual([])
    expect(db.stockItem.find((s) => s.productId === 'p1')!.unit).toBe('pot')
    await stock.updateItemSettings(SITE, 'p2', { variantId: 'v2', alertAt: 1 })
    expect(Number(db.variantStock.find((s) => s.variantId === 'v2')!.quantity)).toBe(0)
    await expect(stock.updateItemSettings(SITE, 'p2', { alertAt: 1 })).rejects.toThrow('variante')
  })

  it('le stock du réseau signale « bas » dès qu’un seuil existe', async () => {
    const { stock, db, prisma } = setup()
    await stock.updateItemSettings(SITE, 'p1', { alertAt: 10 })
    prisma.site.findMany = async () => [{ id: SITE, name: 'Boutique' }]
    const network = new StockNetworkService(prisma as any)
    const res: any = await network.consolidated('org1', {} as any)
    const row = res.rows.find((r: any) => r.name === 'Confiture de figues')
    expect(row.sites[0].low).toBe(true)
    expect(db.stockItem[0].alertAt).toBeTruthy()
  })
})
