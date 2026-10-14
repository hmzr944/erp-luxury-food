import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { ledgerEntryInput, businessDate, businessDayStart, stableStringify, closureInput } from '@erp/utils'
import { ComplianceService } from './compliance.service'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('Grand livre v2', () => {
  let service: ComplianceService
  let tx: any

  beforeEach(() => {
    service = new ComplianceService({} as any)
    tx = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      receiptChain: { findFirst: vi.fn(), create: vi.fn(async ({ data }: any) => ({ id: 'r', ...data })) },
    }
  })

  it('premier ticket : n° 1, empreinte de départ, total perpétuel = montant', async () => {
    tx.receiptChain.findFirst.mockResolvedValue(null)
    vi.setSystemTime(new Date('2026-10-14T10:00:00.000Z'))
    const r = await service.signReceipt(tx, 'site-1', { total: new Decimal('24.50'), kind: 'SALE', content: 'contenu' })
    const data = tx.receiptChain.create.mock.calls[0][0].data
    expect(r.counter).toBe(1)
    expect(r.previousHash).toBe('0'.repeat(64))
    expect(data.version).toBe(2)
    expect(data.perpetualTotal.toFixed(2)).toBe('24.50')
    expect(data.perpetualAbsTotal.toFixed(2)).toBe('24.50')
    const expected = sha(
      ledgerEntryInput({
        previousHash: '0'.repeat(64),
        counter: 1,
        signedAt: '2026-10-14T10:00:00.000Z',
        siteId: 'site-1',
        kind: 'SALE',
        total: '24.50',
        perpetualTotal: '24.50',
        perpetualAbsTotal: '24.50',
        contentDigest: sha('contenu'),
      }),
    )
    expect(r.hash).toBe(expected)
  })

  it('un remboursement baisse le total perpétuel mais augmente le cumul absolu', async () => {
    tx.receiptChain.findFirst.mockResolvedValue({ counter: 7, hash: 'a'.repeat(64), perpetualTotal: new Decimal(100), perpetualAbsTotal: new Decimal(120) })
    await service.signReceipt(tx, 'site-1', { total: new Decimal('-30'), kind: 'REFUND', content: 'retour' })
    const data = tx.receiptChain.create.mock.calls[0][0].data
    expect(data.counter).toBe(8)
    expect(data.previousHash).toBe('a'.repeat(64))
    expect(data.perpetualTotal.toFixed(2)).toBe('70.00')
    expect(data.perpetualAbsTotal.toFixed(2)).toBe('150.00')
  })

  it('après un historique v1, les totaux perpétuels reprennent tout l’historique', async () => {
    tx.receiptChain.findFirst.mockResolvedValue({ counter: 3, hash: 'b'.repeat(64), perpetualTotal: null, perpetualAbsTotal: null })
    tx.$queryRaw.mockResolvedValue([{ total: new Decimal(90), abs: new Decimal(110) }])
    await service.signReceipt(tx, 'site-1', { total: new Decimal('10'), kind: 'SALE', content: 'x' })
    const data = tx.receiptChain.create.mock.calls[0][0].data
    expect(data.perpetualTotal.toFixed(2)).toBe('100.00')
    expect(data.perpetualAbsTotal.toFixed(2)).toBe('120.00')
  })

  it('la vérification repère un montant modifié et un trou de numérotation', async () => {
    const rows: any[] = []
    let prev = '0'.repeat(64)
    let perp = new Decimal(0)
    let abs = new Decimal(0)
    for (const [i, amount] of [12, 8, -5].entries()) {
      const total = new Decimal(amount)
      perp = perp.add(total)
      abs = abs.add(total.abs())
      const row = {
        siteId: 's',
        counter: i + 1,
        version: 2,
        kind: amount < 0 ? 'REFUND' : 'SALE',
        total,
        perpetualTotal: perp,
        perpetualAbsTotal: abs,
        signedAt: new Date(`2026-10-14T10:0${i}:00.000Z`),
        previousHash: prev,
        contentDigest: 'd',
        terminalId: null,
        terminalSignature: null,
        hash: '',
      }
      row.hash = sha(
        ledgerEntryInput({
          previousHash: prev,
          counter: row.counter,
          signedAt: row.signedAt.toISOString(),
          siteId: 's',
          kind: row.kind as 'SALE' | 'REFUND',
          total: total.toFixed(2),
          perpetualTotal: perp.toFixed(2),
          perpetualAbsTotal: abs.toFixed(2),
          contentDigest: 'd',
        }),
      )
      prev = row.hash
      rows.push(row)
    }
    const prisma: any = { receiptChain: { findMany: vi.fn(async () => rows), findUnique: vi.fn(), findFirst: vi.fn() } }
    const svc = new ComplianceService(prisma)
    expect((await svc.verifyChain('s')).valid).toBe(true)

    rows[1] = { ...rows[1], total: new Decimal(80) }
    const tampered = await svc.verifyChain('s')
    expect(tampered.valid).toBe(false)
    expect(tampered.errors.join(' ')).toMatch(/ticket n° 2/)

    rows.splice(1, 1)
    const gap = await svc.verifyChain('s')
    expect(gap.errors.join(' ')).toMatch(/Trou dans la numérotation/)
  })
})

describe('Jour d’activité et formats', () => {
  it('une vente à 1 h du matin compte pour la veille (journée à partir de 5 h)', () => {
    expect(businessDate(new Date('2026-10-14T23:30:00Z'), 'Europe/Paris')).toBe('2026-10-14') // 1 h 30 à Paris
    expect(businessDate(new Date('2026-10-15T03:30:00Z'), 'Europe/Paris')).toBe('2026-10-15') // 5 h 30 à Paris
  })

  it('début du jour d’activité en heure de Paris, été comme hiver', () => {
    expect(businessDayStart('2026-07-01', 'Europe/Paris').toISOString()).toBe('2026-07-01T03:00:00.000Z')
    expect(businessDayStart('2026-12-01', 'Europe/Paris').toISOString()).toBe('2026-12-01T04:00:00.000Z')
  })

  it('le JSON canonique ne dépend pas de l’ordre des clés', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe(stableStringify({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }))
  })

  it('l’empreinte d’une clôture change si un montant change', () => {
    const base = {
      siteId: 's', period: 'DAY' as const, label: '2026-10-14', seq: 1, firstCounter: 1, lastCounter: 3, ticketCount: 3,
      salesTotal: 20, refundsTotal: -5, periodTotal: 15, totalHT: 12.5, totalTax: 2.5,
      taxBreakdown: [{ rate: 20, ht: 12.5, tax: 2.5, ttc: 15 }], paymentBreakdown: [{ code: 'CASH', amount: 15 }],
      perpetualTotal: 15, perpetualAbsTotal: 25, previousHash: '0'.repeat(64), closedAt: '2026-10-15T03:00:00.000Z',
    }
    expect(closureInput(base)).not.toBe(closureInput({ ...base, periodTotal: 16 }))
  })
})
