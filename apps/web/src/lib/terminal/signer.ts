import {
  ECDSA_SIGN_PARAMS,
  canonicalSaleContent,
  sha256Hex,
  terminalReceiptInput,
  type SignedSaleContent,
} from '@erp/utils'

// Signature d'un ticket par la caisse. Fonction pure (hors clé) : la même
// logique tourne en ligne et hors ligne, le serveur la rejoue pour vérifier.

export interface ChainState {
  terminalId: string
  counter: number // dernier numéro signé
  lastHash: string
}

export interface TerminalReceipt {
  counter: number
  previousHash: string
  hash: string
  signature: string // base64
  signedAt: string
  total: number
}

export async function signSale(
  privateKey: CryptoKey,
  state: ChainState,
  sale: { clientId: string; content: SignedSaleContent; total: number; signedAt: Date },
): Promise<{ receipt: TerminalReceipt; next: ChainState }> {
  const counter = state.counter + 1
  const signedAt = sale.signedAt.toISOString()
  const contentDigest = await sha256Hex(canonicalSaleContent(sale.content))
  const hash = await sha256Hex(
    terminalReceiptInput({
      terminalId: state.terminalId,
      clientId: sale.clientId,
      counter,
      previousHash: state.lastHash,
      total: sale.total,
      signedAt,
      contentDigest,
    }),
  )
  const signature = await crypto.subtle.sign(ECDSA_SIGN_PARAMS, privateKey, new TextEncoder().encode(hash))
  return {
    receipt: { counter, previousHash: state.lastHash, hash, signature: toBase64(signature), signedAt, total: sale.total },
    next: { terminalId: state.terminalId, counter, lastHash: hash },
  }
}

function toBase64(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s)
}
