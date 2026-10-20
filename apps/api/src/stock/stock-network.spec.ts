import 'reflect-metadata'
import { Role } from '@erp/types'
import { describe, expect, it, vi } from 'vitest'
import { isAllowed } from '../common/access/workspace-policy'
import { consolidateStock, queryRows, type StockEntry } from './stock-network'
import { StockNetworkController } from './stock-network.controller'
import { StockNetworkService } from './stock-network.service'

const e = (o: Partial<StockEntry> & Pick<StockEntry, 'siteId' | 'name' | 'quantity'>): StockEntry => ({
  productId: `${o.siteId}-${o.name}`, variantId: null, variantName: null, sku: null, barcode: null, unit: 'unité', alertAt: null, ...o,
})

describe('rapprochement du stock entre sites', () => {
  it('par SKU, malgré des noms différents et la casse', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Praliné noisette', sku: 'PRA-01', quantity: 10 }),
      e({ siteId: 'b', name: 'Pralines', sku: ' pra-01 ', quantity: 5 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(15)
    expect(rows[0].matchedBy).toBe('sku')
    expect(rows[0].sites.map((s) => s.siteId)).toEqual(['a', 'b'])
  })

  it('à défaut de SKU, par code-barres', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Café', barcode: '3760001', quantity: 2 }),
      e({ siteId: 'b', name: 'Café grain', barcode: '3760001', quantity: 3 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].matchedBy).toBe('barcode')
  })

  it('à défaut, par nom normalisé (accents, majuscules, espaces)', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Éclair  Café', quantity: 2 }),
      e({ siteId: 'b', name: 'eclair cafe', quantity: 3 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].matchedBy).toBe('name')
  })

  it('des produits différents restent séparés', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Praliné', sku: 'A', quantity: 1 }),
      e({ siteId: 'b', name: 'Calisson', sku: 'B', quantity: 1 }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.matchedBy === null)).toBe(true)
  })

  it('deux produits du même site ne fusionnent jamais, même au même nom', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Thé', productId: 'p1', quantity: 1 }),
      e({ siteId: 'a', name: 'Thé', productId: 'p2', quantity: 4 }),
    ])
    expect(rows).toHaveLength(2)
  })

  it('les variantes se rapprochent par variante, pas entre elles', () => {
    const rows = consolidateStock([
      e({ siteId: 'a', name: 'Coffret', variantName: '6 pièces', quantity: 3 }),
      e({ siteId: 'a', name: 'Coffret', variantName: '12 pièces', quantity: 8 }),
      e({ siteId: 'b', name: 'Coffret', variantName: '6 pièces', quantity: 2 }),
    ])
    expect(rows).toHaveLength(2)
    const six = rows.find((r) => r.variantName === '6 pièces')!
    expect(six.total).toBe(5)
  })

  it('signale les sites au seuil ou en dessous, jamais ceux sans seuil', () => {
    const [row] = consolidateStock([
      e({ siteId: 'a', name: 'Praliné', sku: 'P', quantity: 4, alertAt: 5 }),
      e({ siteId: 'b', name: 'Praliné', sku: 'P', quantity: 5, alertAt: 5 }),
      e({ siteId: 'c', name: 'Praliné', sku: 'P', quantity: 0, alertAt: null }),
      e({ siteId: 'd', name: 'Praliné', sku: 'P', quantity: 50, alertAt: 5 }),
    ])
    expect(row.lowSiteIds).toEqual(['a', 'b'])
    expect(row.total).toBe(59)
  })

  it('un site absent n\'est pas compté à zéro', () => {
    const [row] = consolidateStock([e({ siteId: 'a', name: 'Praliné', quantity: 4 })])
    expect(row.sites).toHaveLength(1)
  })
})

describe('recherche, tri et pagination', () => {
  const rows = consolidateStock([
    e({ siteId: 'a', name: 'Praliné', sku: 'PRA', quantity: 4, alertAt: 5 }),
    e({ siteId: 'a', name: 'Calisson', sku: 'CAL', quantity: 40 }),
    e({ siteId: 'a', name: 'Éclair', barcode: '123', quantity: 12 }),
  ])

  it('recherche par nom sans accent, SKU ou code-barres', () => {
    expect(queryRows(rows, { q: 'eclair' }).rows.map((r) => r.name)).toEqual(['Éclair'])
    expect(queryRows(rows, { q: 'cal' }).rows.map((r) => r.name)).toEqual(['Calisson'])
    expect(queryRows(rows, { q: '123' }).rows).toHaveLength(1)
  })

  it('tri par total et filtre sous seuil', () => {
    expect(queryRows(rows, { sort: 'total', order: 'desc' }).rows.map((r) => r.name)).toEqual(['Calisson', 'Éclair', 'Praliné'])
    const low = queryRows(rows, { lowOnly: true })
    expect(low.rows.map((r) => r.name)).toEqual(['Praliné'])
    expect(low.lowCount).toBe(1)
  })

  it('pagination bornée', () => {
    const many = consolidateStock(Array.from({ length: 30 }, (_, i) => e({ siteId: 'a', name: `P${String(i).padStart(2, '0')}`, quantity: i })))
    const p2 = queryRows(many, { page: 2, pageSize: 10 })
    expect(p2.rows).toHaveLength(10)
    expect(p2.rows[0].name).toBe('P10')
    expect(p2.pageCount).toBe(3)
    expect(queryRows(many, { page: 99, pageSize: 10 }).page).toBe(3)
    expect(queryRows(many, { pageSize: 5000 }).pageSize).toBe(100)
  })
})

function serviceWith(sites: Array<{ id: string; name: string }>) {
  const stockItem = vi.fn(async () => [])
  const variantStock = vi.fn(async () => [])
  const prisma: any = { site: { findMany: vi.fn(async () => sites) }, stockItem: { findMany: stockItem }, variantStock: { findMany: variantStock } }
  return { service: new StockNetworkService(prisma), stockItem }
}

describe('GET /stock/consolidated', () => {
  it('filtre par site et ignore un site étranger à l\'organisation', async () => {
    const { service, stockItem } = serviceWith([{ id: 'a', name: 'Paris' }, { id: 'b', name: 'Lyon' }])
    const r = await service.consolidated('org1', { siteIds: ['b', 'autre-org'] })
    expect(r.sites).toEqual([{ id: 'b', name: 'Lyon' }])
    expect((stockItem.mock.calls[0] as any)[0].where.siteId).toEqual({ in: ['b'] })
  })

  it('aucun site reconnu : réponse vide, aucune lecture de stock', async () => {
    const { service, stockItem } = serviceWith([{ id: 'a', name: 'Paris' }])
    const r = await service.consolidated('org1', { siteIds: ['x'] })
    expect(r.rows).toEqual([])
    expect(stockItem).not.toHaveBeenCalled()
  })

  it('titulaire et gérant seulement', () => {
    expect(Reflect.getMetadata('roles', StockNetworkController)).toEqual([Role.OWNER, Role.MANAGER])
    // Le garde de rôle refuse le vendeur ; la politique d'espaces refuse l'atelier
    expect(isAllowed('PRODUCTION', 'GET', '/api/stock/consolidated')).toBe(false)
    expect(isAllowed('MANAGER', 'GET', '/api/stock/consolidated')).toBe(true)
  })
})
