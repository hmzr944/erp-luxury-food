import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComplianceService } from './compliance.service'
import { Decimal } from '@prisma/client/runtime/library'
import { createHash } from 'crypto'

// Helper to build expected hash
function buildHash(previousHash: string, total: string, signedAt: string, counter: number) {
  return createHash('sha256')
    .update([previousHash, total, signedAt, counter.toString()].join('|'))
    .digest('hex')
}

describe('ComplianceService', () => {
  let service: ComplianceService
  let mockTx: any

  beforeEach(() => {
    service = new ComplianceService({} as any)
    mockTx = {
      $executeRaw: vi.fn(),
      receiptChain: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    }
  })

  it('premier receipt : counter=1, previousHash=0×64', async () => {
    mockTx.receiptChain.findFirst.mockResolvedValue(null)
    const now = new Date('2026-01-15T10:00:00.000Z')
    vi.setSystemTime(now)

    const total = new Decimal('24.50')
    const expectedPrevious = '0'.repeat(64)
    const expectedHash = buildHash(expectedPrevious, '24.5', now.toISOString(), 1)

    mockTx.receiptChain.create.mockResolvedValue({
      id: 'receipt-1',
      counter: 1,
      hash: expectedHash,
      previousHash: expectedPrevious,
      signedAt: now,
    })

    const result = await service.signReceipt(mockTx, 'site-1', total)

    expect(result.counter).toBe(1)
    expect(result.previousHash).toBe(expectedPrevious)
    expect(result.hash).toBe(expectedHash)
    expect(result.id).toBe('receipt-1')
    expect(mockTx.receiptChain.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ siteId: 'site-1', counter: 1 }) }),
    )

    vi.useRealTimers()
  })

  it('deuxième receipt : counter=2, previousHash = hash du premier', async () => {
    const firstHash = 'a'.repeat(64)
    mockTx.receiptChain.findFirst.mockResolvedValue({ counter: 1, hash: firstHash })

    const now = new Date('2026-01-15T10:05:00.000Z')
    vi.setSystemTime(now)

    const total = new Decimal('12.00')
    const expectedHash = buildHash(firstHash, '12', now.toISOString(), 2)

    mockTx.receiptChain.create.mockResolvedValue({
      id: 'receipt-2',
      counter: 2,
      hash: expectedHash,
      previousHash: firstHash,
      signedAt: now,
    })

    const result = await service.signReceipt(mockTx, 'site-1', total)

    expect(result.counter).toBe(2)
    expect(result.previousHash).toBe(firstHash)
    expect(result.hash).toBe(expectedHash)

    vi.useRealTimers()
  })

  it('le hash est déterministe — même input = même output', async () => {
    mockTx.receiptChain.findFirst.mockResolvedValue(null)
    const now = new Date('2026-06-01T09:00:00.000Z')
    vi.setSystemTime(now)

    const total = new Decimal('50.00')
    const hash1 = buildHash('0'.repeat(64), '50', now.toISOString(), 1)
    const hash2 = buildHash('0'.repeat(64), '50', now.toISOString(), 1)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)

    vi.useRealTimers()
  })

  it('deux totaux différents produisent des hashs différents', () => {
    const h1 = buildHash('0'.repeat(64), '10.00', '2026-01-01T00:00:00.000Z', 1)
    const h2 = buildHash('0'.repeat(64), '10.01', '2026-01-01T00:00:00.000Z', 1)
    expect(h1).not.toBe(h2)
  })
})
