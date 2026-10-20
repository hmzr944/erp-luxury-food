import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ECDSA_PARAMS, RECEIPT_GENESIS_HASH } from '@erp/utils'
import { db } from './db'
import { buildBackup, importBackup, parseBackup, BackupError } from './backup'
import { SaleStorageError } from './storage'
import { recordSale, flushSales, countSales } from '@/lib/terminal/terminal'

const SITE = 'site-1'
const offline = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
const sale = (amount: number) => ({
  items: [{ productId: 'p1', quantity: 1, unitPrice: amount, taxRate: 20 }],
  payments: [{ code: 'CARD', amount }],
  priceIncludesTax: true,
})

beforeEach(async () => {
  await db.sales.clear()
  await db.terminals.clear()
  const keys = await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
  await db.terminals.put({ siteId: SITE, terminalId: 'term-1', name: 'Caisse 1', privateKey: keys.privateKey, counter: 0, lastHash: RECEIPT_GENESIS_HASH })
  vi.stubGlobal('localStorage', { getItem: () => 'token', setItem: () => {}, removeItem: () => {} })
  offline()
})
afterEach(() => vi.restoreAllMocks())

describe('écriture d\'une vente signée', () => {
  it('quota dépassé : erreur visible, ni vente, ni compteur avancé, réessai possible', async () => {
    const quota = Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' })
    const spy = vi.spyOn(db.sales, 'add').mockRejectedValueOnce(quota)
    const err = await recordSale(SITE, sale(10)).catch((e) => e)
    expect(err).toBeInstanceOf(SaleStorageError)
    expect(err.reason).toBe('quota')
    expect(err.message).toContain("La vente n'a pas pu être gardée sur cet appareil")
    expect(err.message).not.toMatch(/[—–]/)
    expect(await db.sales.count()).toBe(0)
    expect(await db.terminals.get(SITE)).toMatchObject({ counter: 0, lastHash: RECEIPT_GENESIS_HASH })

    spy.mockRestore()
    const retry = await recordSale(SITE, sale(10))
    expect(retry.receipt.counter).toBe(1)
    expect(await db.sales.count()).toBe(1)
  })

  it('base fermée : erreur visible', async () => {
    vi.spyOn(db.sales, 'add').mockRejectedValueOnce(Object.assign(new Error('closed'), { name: 'DatabaseClosedError' }))
    const err = await recordSale(SITE, sale(10)).catch((e) => e)
    expect(err).toBeInstanceOf(SaleStorageError)
    expect(err.reason).toBe('closed')
  })
})

describe('sauvegarde de secours', () => {
  it('exporte les ventes en attente, sans clé, avec empreinte', async () => {
    await recordSale(SITE, sale(10))
    await recordSale(SITE, sale(20))
    const backup = await buildBackup(SITE, new Date('2026-10-20T10:00:00Z'))
    const text = JSON.stringify(backup)
    expect(backup.sales.map((s) => s.counter)).toEqual([1, 2])
    expect(backup.terminalIds).toEqual(['term-1'])
    expect(backup.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(text).not.toMatch(/privateKey/)
    const stored = await db.sales.toArray()
    expect(backup.sales[0].payload).toEqual(JSON.parse(JSON.stringify(stored[0].payload)))
  })

  it('réimport après perte : remet les ventes telles quelles, deux fois sans doublon', async () => {
    await recordSale(SITE, sale(10))
    await recordSale(SITE, sale(20))
    const before = JSON.stringify((await db.sales.toArray()).sort((a, b) => a.counter - b.counter).map((s) => s.payload))
    const file = JSON.stringify(await buildBackup(SITE))

    await db.sales.clear() // stockage vidé
    const parsed = await parseBackup(file)
    expect(await importBackup(SITE, parsed)).toEqual({ added: 2, alreadyHere: 0, conflicts: 0 })
    expect(await importBackup(SITE, parsed)).toEqual({ added: 0, alreadyHere: 2, conflicts: 0 })
    expect(await db.sales.count()).toBe(2)
    expect(JSON.stringify((await db.sales.toArray()).sort((a, b) => a.counter - b.counter).map((s) => s.payload))).toBe(before)
    expect(await countSales(SITE)).toEqual({ pending: 2, rejected: 0 })
  })

  it('ventes déjà parties : le réimport ne les recrée pas, et le serveur les dédoublonne par clientId', async () => {
    await recordSale(SITE, sale(10))
    const parsed = await parseBackup(JSON.stringify(await buildBackup(SITE)))
    const serverOrders = new Map<string, string>()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init: RequestInit) => {
        const { clientId } = JSON.parse(String(init.body))
        if (!serverOrders.has(clientId)) serverOrders.set(clientId, `order-${serverOrders.size + 1}`)
        return new Response(JSON.stringify({ id: serverOrders.get(clientId) }), { status: 200 })
      }),
    )
    await flushSales(SITE)
    expect(await countSales(SITE)).toEqual({ pending: 0, rejected: 0 })

    // Déjà envoyée et encore sur l'appareil : ignorée
    expect(await importBackup(SITE, parsed)).toEqual({ added: 0, alreadyHere: 1, conflicts: 0 })

    // Appareil vidé après l'envoi : remise en file, le serveur répond avec la commande existante
    await db.sales.clear()
    expect((await importBackup(SITE, parsed)).added).toBe(1)
    await flushSales(SITE)
    expect(serverOrders.size).toBe(1)
    expect((await db.sales.toArray())[0].status).toBe('synced')
  })

  it('refuse un fichier modifié, tronqué ou étranger, sans rien importer', async () => {
    await recordSale(SITE, sale(10))
    const file = await buildBackup(SITE)
    const tampered = JSON.stringify({ ...file, sales: [{ ...file.sales[0], total: 1 }] })
    await expect(parseBackup(tampered)).rejects.toThrow(/empreinte/)
    await expect(parseBackup(JSON.stringify(file).slice(0, 40))).rejects.toBeInstanceOf(BackupError)
    await expect(parseBackup('{"format":"autre"}')).rejects.toThrow(/pas une sauvegarde/)
    await expect(importBackup('autre-site', file)).rejects.toThrow(/autre boutique/)
    expect(await db.sales.count()).toBe(1)
  })

  it('même caisse, même numéro, autre vente : signalé, pas écrasé', async () => {
    await recordSale(SITE, sale(10))
    const file = await buildBackup(SITE)
    const [existing] = await db.sales.toArray()
    await db.sales.update(existing.id!, { clientId: 'autre' })
    expect(await importBackup(SITE, file)).toEqual({ added: 0, alreadyHere: 0, conflicts: 1 })
  })
})
