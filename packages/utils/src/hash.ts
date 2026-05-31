// NF525 hash utilities — client-side verification only
// The authoritative hash is always computed server-side in ComplianceService

export const NF525_HASH_SEED = '0'.repeat(64)

export const buildHashInput = (
  previousHash: string,
  total: string,
  signedAt: string,
  counter: number,
): string => [previousHash, total, signedAt, counter.toString()].join('|')

// Verify a receipt chain entry (browser/Node environment)
export const verifyReceiptHash = async (
  hash: string,
  previousHash: string,
  total: string,
  signedAt: string,
  counter: number,
): Promise<boolean> => {
  const data = buildHashInput(previousHash, total, signedAt, counter)
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const computed = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return computed === hash
}
