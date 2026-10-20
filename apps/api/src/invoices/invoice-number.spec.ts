import { describe, it, expect } from 'vitest'
import { nextInvoiceNumber, formatInvoiceNumber, type InvoiceNumberTx } from './invoice-number'

// Base simulée : les transactions s'exécutent l'une après l'autre (comme le verrou de ligne de Postgres) et une erreur annule leurs écritures.
function fakeDb() {
  const rows = new Map<string, { lastNumber: number; prefix: string }>()
  let queue: Promise<unknown> = Promise.resolve()
  const tx: InvoiceNumberTx = {
    invoiceSequence: {
      createMany: async ({ data }) => {
        await Promise.resolve()
        for (const d of data) {
          const k = `${d.organizationId}:${d.year}`
          if (!rows.has(k)) rows.set(k, { lastNumber: d.lastNumber, prefix: d.prefix })
        }
      },
      update: async ({ where, data }) => {
        await Promise.resolve()
        const k = `${where.organizationId_year.organizationId}:${where.organizationId_year.year}`
        const row = rows.get(k)!
        row.lastNumber += data.lastNumber.increment
        return { ...row }
      },
    },
  }
  const transaction = <T>(fn: (t: InvoiceNumberTx) => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const snapshot = new Map([...rows].map(([k, v]) => [k, { ...v }]))
      try {
        return await fn(tx)
      } catch (e) {
        rows.clear()
        snapshot.forEach((v, k) => rows.set(k, v))
        throw e
      }
    })
    queue = run.catch(() => undefined)
    return run
  }
  return { transaction }
}

describe('nextInvoiceNumber', () => {
  it('formate FA-AAAA-NNNN', () => {
    expect(formatInvoiceNumber('FA', 2026, 7)).toBe('FA-2026-0007')
    expect(formatInvoiceNumber('FA', 2026, 12345)).toBe('FA-2026-12345')
  })

  it('numérote sans trou à partir de 1', async () => {
    const db = fakeDb()
    const now = new Date(2026, 5, 1)
    const out: string[] = []
    for (let i = 0; i < 3; i++) out.push(await db.transaction((t) => nextInvoiceNumber(t, 'org1', now)))
    expect(out).toEqual(['FA-2026-0001', 'FA-2026-0002', 'FA-2026-0003'])
  })

  it('sous concurrence : numéros distincts et consécutifs', async () => {
    const db = fakeDb()
    const now = new Date(2026, 5, 1)
    const out = await Promise.all(Array.from({ length: 25 }, () => db.transaction((t) => nextInvoiceNumber(t, 'org1', now))))
    expect(new Set(out).size).toBe(25)
    expect([...out].sort()).toEqual(Array.from({ length: 25 }, (_, i) => `FA-2026-${String(i + 1).padStart(4, '0')}`))
  })

  it('une transaction annulée ne consomme pas de numéro', async () => {
    const db = fakeDb()
    const now = new Date(2026, 5, 1)
    expect(await db.transaction((t) => nextInvoiceNumber(t, 'org1', now))).toBe('FA-2026-0001')
    await expect(db.transaction(async (t) => { await nextInvoiceNumber(t, 'org1', now); throw new Error('échec') })).rejects.toThrow('échec')
    expect(await db.transaction((t) => nextInvoiceNumber(t, 'org1', now))).toBe('FA-2026-0002')
  })

  it('un compteur par année et par organisation', async () => {
    const db = fakeDb()
    const n = (org: string, y: number) => db.transaction((t) => nextInvoiceNumber(t, org, new Date(y, 11, 31)))
    expect(await n('org1', 2026)).toBe('FA-2026-0001')
    expect(await n('org1', 2026)).toBe('FA-2026-0002')
    expect(await n('org1', 2027)).toBe('FA-2027-0001')
    expect(await n('org2', 2026)).toBe('FA-2026-0001')
    expect(await n('org1', 2026)).toBe('FA-2026-0003')
  })
})
