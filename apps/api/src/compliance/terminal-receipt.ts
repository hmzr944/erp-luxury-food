import { webcrypto } from 'node:crypto'
import {
  ECDSA_PARAMS,
  ECDSA_SIGN_PARAMS,
  canonicalSaleContent,
  sha256Hex,
  terminalReceiptInput,
  type SignedSaleContent,
  type TerminalReceiptFields,
} from '@erp/utils'

export interface ReceiptToVerify {
  publicKeyJwk: webcrypto.JsonWebKey
  content: SignedSaleContent
  fields: Omit<TerminalReceiptFields, 'contentDigest'>
  hash: string
  signature: string // base64
}

// Vérifie qu'un ticket a bien été signé par la caisse et n'a pas été modifié
export async function verifyTerminalReceipt(r: ReceiptToVerify): Promise<{ ok: true } | { ok: false; reason: string }> {
  const contentDigest = await sha256Hex(canonicalSaleContent(r.content))
  const expected = await sha256Hex(terminalReceiptInput({ ...r.fields, contentDigest }))
  if (expected !== r.hash) return { ok: false, reason: 'Empreinte du ticket incorrecte (contenu modifié)' }

  let key: webcrypto.CryptoKey
  try {
    key = await webcrypto.subtle.importKey('jwk', r.publicKeyJwk, ECDSA_PARAMS, false, ['verify'])
  } catch {
    return { ok: false, reason: 'Clé publique de la caisse illisible' }
  }
  const valid = await webcrypto.subtle.verify(
    ECDSA_SIGN_PARAMS,
    key,
    Buffer.from(r.signature, 'base64'),
    new TextEncoder().encode(r.hash),
  )
  return valid ? { ok: true } : { ok: false, reason: 'Signature de la caisse invalide' }
}
