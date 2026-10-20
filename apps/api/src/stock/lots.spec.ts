import 'reflect-metadata'
import { Decimal } from '@prisma/client/runtime/library'
import { Role } from '@erp/types'
import { describe, expect, it } from 'vitest'
import { RolesGuard } from '../common/guards/roles.guard'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { Reflector } from '@nestjs/core'
import { daysLeft, lotStatus, matchesFilter, onlyExpired, parisDay, productsToClear, dateKindOf } from './lots'
import { LotsController } from './lots.controller'
import { LotsService } from './lots.service'
import { StockService } from './stock.service'

// Base en mémoire : juste assez de Prisma pour les lots, le stock et les mouvements
interface Row { [k: string]: any }
function fakePrisma(products: Row[]) {
  const db = {
    lots: [] as Row[],
    items: new Map<string, Row>(),
    variantStocks: new Map<string, Row>(),
    movements: [] as Row[],
  }
  let n = 0
  const id = () => `id${++n}`
  const matchLot = (l: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'gt' in v) return new Decimal(l[k]).gt(v.gt)
      if (v && typeof v === 'object' && 'gte' in v) return new Decimal(l[k]).gte(v.gte)
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(l[k])
      return (l[k] ?? null) === (v ?? null)
    })
  const tx: any = {
    stockLot: {
      findMany: async ({ where }: Row = {}) => {
        const rows = db.lots.filter((l) => matchLot(l, where))
        return rows.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.receivedAt - b.receivedAt)
      },
      findFirst: async ({ where }: Row) => {
        const l = db.lots.find((x) => matchLot(x, where))
        return l ? { ...l } : null
      },
      create: async ({ data }: Row) => {
        const row = { id: id(), ...data }
        db.lots.push(row)
        return row
      },
      createMany: async ({ data }: Row) => {
        for (const d of data) db.lots.push({ id: id(), ...d })
      },
      update: async ({ where, data }: Row) => Object.assign(db.lots.find((l) => l.id === where.id)!, data),
      updateMany: async ({ where, data }: Row) => {
        const rows = db.lots.filter((l) => l.id === where.id && matchLot(l, { quantity: where.quantity }))
        for (const r of rows) r.quantity = data.quantity.decrement ? r.quantity.sub(data.quantity.decrement) : data.quantity
        return { count: rows.length }
      },
    },
    stockItem: {
      findUnique: async ({ where }: Row) => db.items.get(where.productId) ?? null,
      update: async ({ where, data }: Row) => Object.assign(db.items.get(where.productId)!, data),
      upsert: async ({ where, update, create }: Row) => {
        const cur = db.items.get(where.productId)
        if (cur) cur.quantity = cur.quantity.add(update.quantity.increment)
        else db.items.set(where.productId, { ...create })
      },
    },
    variantStock: {
      findUnique: async ({ where }: Row) => db.variantStocks.get(where.variantId) ?? null,
      update: async ({ where, data }: Row) => Object.assign(db.variantStocks.get(where.variantId)!, data),
      upsert: async ({ where, update, create }: Row) => {
        const cur = db.variantStocks.get(where.variantId)
        if (cur) cur.quantity = cur.quantity.add(update.quantity.increment)
        else db.variantStocks.set(where.variantId, { ...create })
      },
    },
    stockMovement: {
      create: async ({ data }: Row) => {
        const row = { id: id(), ...data }
        db.movements.push(row)
        return row
      },
    },
    product: {
      findFirst: async ({ where }: Row) => products.find((p) => p.id === where.id && (!where.siteId || p.siteId === where.siteId)) ?? null,
    },
  }
  return { db, prisma: { ...tx, $transaction: async (cb: (t: any) => unknown) => cb(tx) } as any }
}

const product = (over: Row = {}) => ({ id: 'p1', siteId: 's1', tracking: 'LOT_EXPIRY', soldByWeight: false, variants: [], ...over })

describe('dates limites en heure de Paris', () => {
  it('lit le jour à Paris, pas en UTC', () => {
    // 22h30 UTC le 19/10 = 00h30 à Paris le 20/10 (heure d'été)
    expect(parisDay(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20')
    expect(parisDay(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })

  it('un lot du jour reste vendable, il est périmé dès le lendemain', () => {
    const expiry = new Date('2026-10-20T00:00:00Z')
    expect(lotStatus(expiry, new Date('2026-10-20T10:00:00Z')).status).toBe('TODAY')
    // 23h30 UTC le 20/10 = déjà le 21/10 à Paris
    expect(lotStatus(expiry, new Date('2026-10-20T22:30:00Z'))).toEqual({ status: 'EXPIRED', daysLeft: -1 })
    // 21h30 UTC le 20/10 = 23h30 à Paris : encore le 20/10
    expect(lotStatus(expiry, new Date('2026-10-20T21:30:00Z')).status).toBe('TODAY')
  })

  it('traverse le changement d’heure de la fin octobre sans décaler d’un jour', () => {
    expect(daysLeft(new Date('2026-10-26T00:00:00Z'), new Date('2026-10-24T12:00:00Z'))).toBe(2)
  })

  it('classe les lots par échéance', () => {
    const now = new Date('2026-10-20T09:00:00Z')
    const s = (d: string | null) => lotStatus(d ? new Date(`${d}T00:00:00Z`) : null, now).status
    expect(s(null)).toBe('NO_DATE')
    expect(s('2026-10-19')).toBe('EXPIRED')
    expect(s('2026-10-23')).toBe('SOON')
    expect(s('2026-10-27')).toBe('SOON')
    expect(s('2026-10-28')).toBe('NEAR')
    expect(s('2026-11-19')).toBe('NEAR')
    expect(s('2026-11-20')).toBe('OK')
  })

  it('filtre périmés, 7 jours, 30 jours, tous', () => {
    const days = [-3, 0, 5, 7, 8, 30, 31, null]
    const f = (k: any) => days.filter((d) => matchesFilter(d, k))
    expect(f('expired')).toEqual([-3])
    expect(f('7')).toEqual([0, 5, 7])
    expect(f('30')).toEqual([0, 5, 7, 8, 30])
    expect(f('all')).toHaveLength(8)
  })

  it('DLC par défaut, DDM si le produit le dit', () => {
    expect(dateKindOf({})).toBe('DLC')
    expect(dateKindOf(null)).toBe('DLC')
    expect(dateKindOf({ dateKind: 'DDM' })).toBe('DDM')
  })

  it('met en avant les produits à écouler, le plus pressé d’abord', () => {
    const lots = [
      { productId: 'a', productName: 'Fromage', unit: 'unité', quantity: 4, daysLeft: 5 },
      { productId: 'a', productName: 'Fromage', unit: 'unité', quantity: 2, daysLeft: 2 },
      { productId: 'b', productName: 'Pâté', unit: 'unité', quantity: 1, daysLeft: 0 },
      { productId: 'c', productName: 'Miel', unit: 'unité', quantity: 9, daysLeft: 40 },
      { productId: 'd', productName: 'Lait', unit: 'unité', quantity: 3, daysLeft: -1 },
    ]
    expect(productsToClear(lots).map((l) => [l.productId, l.quantity, l.daysLeft])).toEqual([['b', 1, 0], ['a', 6, 2]])
  })

  it('repère les produits qui n’ont plus que des lots périmés', () => {
    expect(
      onlyExpired([
        { productId: 'a', quantity: 3, daysLeft: -2 },
        { productId: 'b', quantity: 3, daysLeft: -2 },
        { productId: 'b', quantity: 1, daysLeft: 4 },
        { productId: 'c', quantity: 1, daysLeft: -1 },
        { productId: 'c', quantity: 2, daysLeft: null },
        { productId: 'd', quantity: 0, daysLeft: -1 },
      ]),
    ).toEqual(['a'])
  })
})

describe('réception d’un lot', () => {
  it('crée le lot, le stock et le mouvement d’entrée ensemble', async () => {
    const { db, prisma } = fakePrisma([product()])
    const svc = new LotsService(prisma)
    const r = await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'L42', expiresAt: '2026-11-15', quantity: 12 })
    expect(db.lots).toHaveLength(1)
    expect(db.lots[0]).toMatchObject({ lotNumber: 'L42', siteId: 's1', productId: 'p1' })
    expect(db.lots[0].expiresAt.toISOString()).toBe('2026-11-15T00:00:00.000Z')
    expect(Number(db.lots[0].quantity)).toBe(12)
    expect(Number(db.items.get('p1')!.quantity)).toBe(12)
    expect(db.movements).toEqual([expect.objectContaining({ type: 'RESTOCK', lotId: r.lotId, userId: 'u1', reason: 'Lot L42' })])
    expect(Number(db.movements[0].quantity)).toBe(12)
  })

  it('garde le stock égal au total des mouvements après plusieurs lots', async () => {
    const { db, prisma } = fakePrisma([product()])
    const svc = new LotsService(prisma)
    await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'A', expiresAt: '2026-11-01', quantity: 5 })
    await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'B', expiresAt: '2026-12-01', quantity: 7 })
    const lotsTotal = db.lots.reduce((t, l) => t + Number(l.quantity), 0)
    const moved = db.movements.reduce((t, m) => t + Number(m.quantity), 0)
    expect(Number(db.items.get('p1')!.quantity)).toBe(12)
    expect(lotsTotal).toBe(12)
    expect(moved).toBe(12)
  })

  it('ajoute à un lot déjà reçu de même date, refuse une autre date', async () => {
    const { db, prisma } = fakePrisma([product()])
    const svc = new LotsService(prisma)
    await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'A', expiresAt: '2026-11-01', quantity: 5 })
    await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'A', expiresAt: '2026-11-01', quantity: 3 })
    expect(db.lots).toHaveLength(1)
    expect(Number(db.lots[0].quantity)).toBe(8)
    await expect(svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'A', expiresAt: '2026-11-02', quantity: 1 })).rejects.toThrow('autre date limite')
    expect(Number(db.items.get('p1')!.quantity)).toBe(8)
  })

  it('exige la date limite, le n° de lot et une quantité entière selon le suivi', async () => {
    const { prisma } = fakePrisma([product(), product({ id: 'p2', tracking: 'LOT' }), product({ id: 'p3', tracking: 'NONE' })])
    const svc = new LotsService(prisma)
    await expect(svc.receive('s1', 'u', { productId: 'p1', quantity: 2 })).rejects.toThrow('date limite est obligatoire')
    await expect(svc.receive('s1', 'u', { productId: 'p1', expiresAt: '2026-02-30', quantity: 2 })).rejects.toThrow('illisible')
    await expect(svc.receive('s1', 'u', { productId: 'p1', expiresAt: '2026-11-01', quantity: 2.5 })).rejects.toThrow('entier')
    await expect(svc.receive('s1', 'u', { productId: 'p1', expiresAt: '2026-11-01', quantity: 0 })).rejects.toThrow('Quantité')
    await expect(svc.receive('s1', 'u', { productId: 'p2', quantity: 2 })).rejects.toThrow('numéro de lot')
    await expect(svc.receive('s1', 'u', { productId: 'p3', quantity: 2 })).rejects.toThrow('pas suivi par lot')
    await expect(svc.receive('autre', 'u', { productId: 'p1', quantity: 2, expiresAt: '2026-11-01' })).rejects.toThrow('introuvable')
  })

  it('refuse une réception datée dans le futur', async () => {
    const { prisma } = fakePrisma([product()])
    const svc = new LotsService(prisma)
    await expect(svc.receive('s1', 'u', { productId: 'p1', expiresAt: '2026-11-01', quantity: 1, receivedAt: '2090-01-01' })).rejects.toThrow('futur')
  })

  it('range un produit à variantes dans le stock de sa variante', async () => {
    const { db, prisma } = fakePrisma([product({ variants: [{ id: 'v1' }] })])
    const svc = new LotsService(prisma)
    await expect(svc.receive('s1', 'u', { productId: 'p1', expiresAt: '2026-11-01', quantity: 2 })).rejects.toThrow('variante')
    await svc.receive('s1', 'u', { productId: 'p1', variantId: 'v1', expiresAt: '2026-11-01', quantity: 6 })
    expect(Number(db.variantStocks.get('v1')!.quantity)).toBe(6)
    expect(db.items.size).toBe(0)
  })

  it('crée une pièce par numéro de série et refuse un numéro connu', async () => {
    const { db, prisma } = fakePrisma([product({ tracking: 'SERIAL' })])
    const svc = new LotsService(prisma)
    const r = await svc.receive('s1', 'u', { productId: 'p1', serialNumbers: ['A1', 'A2', ' A2 '] })
    expect(r.quantity).toBe(2)
    expect(db.lots.map((l) => l.serialNumber)).toEqual(['A1', 'A2'])
    expect(Number(db.items.get('p1')!.quantity)).toBe(2)
    await expect(svc.receive('s1', 'u', { productId: 'p1', serialNumbers: ['A2'] })).rejects.toThrow('déjà enregistrés')
  })
})

describe('retrait d’un lot (perte)', () => {
  async function setup() {
    const f = fakePrisma([product()])
    const svc = new LotsService(f.prisma)
    const r = await svc.receive('s1', 'u1', { productId: 'p1', lotNumber: 'A', expiresAt: '2026-10-01', quantity: 10 })
    return { ...f, svc, lotId: r.lotId }
  }

  it('sort le lot du stock et note un mouvement LOSS lié au lot, avec son motif', async () => {
    const { db, svc, lotId } = await setup()
    const out = await svc.loss('s1', 'u2', lotId, { reason: 'Périmé, jeté' })
    expect(out).toMatchObject({ quantity: 10, remaining: 0 })
    expect(Number(db.lots[0].quantity)).toBe(0)
    expect(Number(db.items.get('p1')!.quantity)).toBe(0)
    const loss = db.movements.at(-1)!
    expect(loss).toMatchObject({ type: 'LOSS', lotId, reason: 'Périmé, jeté', userId: 'u2', siteId: 's1' })
    expect(Number(loss.quantity)).toBe(10)
  })

  it('accepte un retrait partiel', async () => {
    const { db, svc, lotId } = await setup()
    await svc.loss('s1', 'u2', lotId, { quantity: 4, reason: 'Emballage abîmé' })
    expect(Number(db.lots[0].quantity)).toBe(6)
    expect(Number(db.items.get('p1')!.quantity)).toBe(6)
  })

  it('exige un motif, une quantité possible et un lot du site', async () => {
    const { db, svc, lotId } = await setup()
    await expect(svc.loss('s1', 'u', lotId, { reason: '  ' })).rejects.toThrow('motif')
    await expect(svc.loss('s1', 'u', lotId, { quantity: 11, reason: 'Casse' })).rejects.toThrow('ne contient que')
    await expect(svc.loss('s1', 'u', lotId, { quantity: 0, reason: 'Casse' })).rejects.toThrow('invalide')
    await expect(svc.loss('s2', 'u', lotId, { reason: 'Casse' })).rejects.toThrow('introuvable')
    expect(db.movements).toHaveLength(1)
    expect(Number(db.lots[0].quantity)).toBe(10)
  })

  it('un lot vidé ne peut plus être retiré deux fois', async () => {
    const { svc, lotId } = await setup()
    await svc.loss('s1', 'u', lotId, { reason: 'Périmé' })
    await expect(svc.loss('s1', 'u', lotId, { reason: 'Périmé' })).rejects.toThrow('déjà vide')
  })
})

describe('sortie FEFO à la vente', () => {
  it('sort d’abord le lot le plus proche de sa date, puis le suivant', async () => {
    const { db, prisma } = fakePrisma([product()])
    const lots = new LotsService(prisma)
    await lots.receive('s1', 'u', { productId: 'p1', lotNumber: 'TARD', expiresAt: '2026-12-01', quantity: 5 })
    await lots.receive('s1', 'u', { productId: 'p1', lotNumber: 'TOT', expiresAt: '2026-11-01', quantity: 3 })
    // La vente passe par la file : StockService lit les lots dans l'ordre FEFO
    const stock = new StockService(prisma, {} as any)
    let asked: Row = {}
    ;(prisma as any).stockLot.findMany = async ({ where, orderBy }: Row) => {
      asked = { where, orderBy }
      return db.lots.filter((l) => l.productId === where.productId && Number(l.quantity) > 0 && l.serialNumber == null)
        .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
    }
    await stock.decrementItems({ siteId: 's1', orderId: 'o1', items: [{ productId: 'p1', quantity: 4 }] })
    // Le moteur demande bien la date limite croissante, sans date en dernier
    expect(asked.orderBy[0]).toEqual({ expiresAt: { sort: 'asc', nulls: 'last' } })
    const byNumber = Object.fromEntries(db.lots.map((l) => [l.lotNumber, Number(l.quantity)]))
    expect(byNumber).toEqual({ TOT: 0, TARD: 4 })
    expect(Number(db.items.get('p1')!.quantity)).toBe(4)
    const sale = db.movements.at(-1)!
    expect(sale).toMatchObject({ type: 'SALE', orderId: 'o1' })
    expect(db.lots.find((l) => l.id === sale.lotId)!.lotNumber).toBe('TOT')
  })
})

describe('droits', () => {
  const metaOf = (name: keyof LotsController) => Reflect.getMetadata(ROLES_KEY, LotsController.prototype[name])
  const guard = new RolesGuard(new Reflector())
  const ctx = (name: keyof LotsController, role: string) =>
    ({
      getHandler: () => LotsController.prototype[name],
      getClass: () => LotsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    }) as any

  it('la lecture reste ouverte à tous les rôles du site', () => {
    expect(metaOf('list')).toBeUndefined()
    expect(metaOf('expiredOnly')).toBeUndefined()
    for (const role of [Role.SELLER, Role.MANAGER, Role.OWNER]) expect(guard.canActivate(ctx('list', role))).toBe(true)
  })

  it('la réception et le retrait sont réservés au titulaire et au gérant', () => {
    for (const name of ['receive', 'loss'] as const) {
      expect(metaOf(name)).toEqual([Role.OWNER, Role.MANAGER])
      expect(guard.canActivate(ctx(name, Role.OWNER))).toBe(true)
      expect(guard.canActivate(ctx(name, Role.MANAGER))).toBe(true)
      expect(guard.canActivate(ctx(name, Role.SELLER))).toBe(false)
    }
  })
})
