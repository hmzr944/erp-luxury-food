// Format des tickets signés par une caisse. Partagé entre la caisse (qui
// signe) et le serveur (qui vérifie) : la moindre différence de format
// rendrait toutes les signatures invalides. Ne jamais modifier un format
// existant ; en créer un nouveau (v2) si besoin.

export const RECEIPT_FORMAT = 'v1'
export const RECEIPT_GENESIS_HASH = '0'.repeat(64)

export interface SignedSaleItem {
  productId: string
  variantId?: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  discount?: number
  serialNumber?: string | null
  // Article libre : nom saisi en caisse
  customName?: string | null
}

export interface SignedSaleContent {
  items: SignedSaleItem[]
  payments: Array<{ code: string; amount: number }>
  orderDiscount?: number
}

export interface TerminalReceiptFields {
  terminalId: string
  clientId: string
  counter: number
  previousHash: string
  total: number
  signedAt: string // ISO 8601
  contentDigest: string
}

const money = (n: number | undefined) => (n ?? 0).toFixed(2)

// Représentation canonique du contenu : ordre des champs et des lignes figé
export function canonicalSaleContent(content: SignedSaleContent): string {
  const items = content.items.map((i) => {
    const fields = [i.productId, i.variantId ?? '', i.quantity, money(i.unitPrice), money(i.taxRate), money(i.discount), i.serialNumber ?? '']
    // Ajouté à la fin et seulement s'il existe : les tickets déjà signés restent valides
    if (i.customName) fields.push(`name=${encodeURIComponent(i.customName)}`)
    return fields.join(',')
  })
  const payments = content.payments.map((p) => `${p.code},${money(p.amount)}`)
  return [`items:${items.join(';')}`, `payments:${payments.join(';')}`, `discount:${money(content.orderDiscount)}`].join('|')
}

export function terminalReceiptInput(r: TerminalReceiptFields): string {
  return [RECEIPT_FORMAT, r.terminalId, r.clientId, r.counter, r.previousHash, money(r.total), r.signedAt, r.contentDigest].join('|')
}

// SHA-256 hexadécimal, identique dans le navigateur et dans Node (WebCrypto)
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const ECDSA_PARAMS = { name: 'ECDSA', namedCurve: 'P-256' } as const
export const ECDSA_SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const
