// Encodeur ASN.1 DER minimal, juste ce qu'il faut pour écrire un certificat
// X.509 (cert.ts). Aucune dépendance : Buffer de Node.js uniquement.

export type Der = Buffer

function encodeLength(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n])
  const bytes: number[] = []
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff)
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

export function tlv(tag: number, ...content: Buffer[]): Der {
  const body = Buffer.concat(content)
  return Buffer.concat([Buffer.from([tag]), encodeLength(body.length), body])
}

export const sequence = (...items: Der[]) => tlv(0x30, ...items)
export const set = (...items: Der[]) => tlv(0x31, ...items)
export const nullValue = () => Buffer.from([0x05, 0x00])
export const boolean = (v: boolean) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]))
export const octetString = (v: Buffer) => tlv(0x04, v)
export const utf8String = (s: string) => tlv(0x0c, Buffer.from(s, 'utf8'))
export const ia5String = (s: string) => tlv(0x16, Buffer.from(s, 'ascii'))

// Entier positif (numéro de série, version) : en tête un 0 si le bit de poids fort est à 1
export function integer(v: number | Buffer): Der {
  let bytes: Buffer
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Entier DER invalide : ${v}`)
    const arr: number[] = []
    for (let n = v; n > 0; n = Math.floor(n / 256)) arr.unshift(n & 0xff)
    bytes = Buffer.from(arr.length ? arr : [0])
  } else {
    let i = 0
    while (i < v.length - 1 && v[i] === 0) i++
    bytes = v.subarray(i)
    if (bytes.length === 0) bytes = Buffer.from([0])
  }
  if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes])
  return tlv(0x02, bytes)
}

export function oid(dotted: string): Der {
  const parts = dotted.split('.').map((p) => Number(p))
  if (parts.length < 2 || parts.some((p) => !Number.isSafeInteger(p) || p < 0)) throw new Error(`OID invalide : ${dotted}`)
  const out: number[] = [parts[0] * 40 + parts[1]]
  for (const p of parts.slice(2)) {
    const chunk: number[] = [p & 0x7f]
    for (let n = Math.floor(p / 128); n > 0; n = Math.floor(n / 128)) chunk.unshift((n & 0x7f) | 0x80)
    out.push(...chunk)
  }
  return tlv(0x06, Buffer.from(out))
}

// BIT STRING d'octets entiers (signature, clé publique)
export const bitString = (v: Buffer) => tlv(0x03, Buffer.from([0]), v)

// BIT STRING nommé (keyUsage) : bit 0 = bit de poids fort du premier octet,
// sans les zéros de fin (règle DER)
export function namedBits(bits: number[]): Der {
  const max = Math.max(...bits)
  const bytes = Buffer.alloc(Math.floor(max / 8) + 1)
  for (const b of bits) bytes[Math.floor(b / 8)] |= 0x80 >> b % 8
  const unused = 7 - (max % 8)
  return tlv(0x03, Buffer.from([unused]), bytes)
}

// UTCTime jusqu'en 2049, GeneralizedTime ensuite (RFC 5280, 4.1.2.5)
export function time(d: Date): Der {
  const iso = d.toISOString().replace(/[-:T]/g, '').slice(0, 14) // AAAAMMJJhhmmss
  const year = d.getUTCFullYear()
  if (year >= 1950 && year < 2050) return tlv(0x17, Buffer.from(iso.slice(2) + 'Z', 'ascii'))
  return tlv(0x18, Buffer.from(iso + 'Z', 'ascii'))
}

// Étiquettes contextuelles : [n] EXPLICIT enveloppe, [n] IMPLICIT remplace l'étiquette
export const explicit = (n: number, inner: Der) => tlv(0xa0 | n, inner)
export const implicitPrimitive = (n: number, content: Buffer) => tlv(0x80 | n, content)
export const implicitConstructed = (n: number, ...content: Der[]) => tlv(0xa0 | n, ...content)

// Lecture minimale : contenu d'un élément DER (pour extraire la clé publique d'un SPKI)
export function readElement(buf: Buffer, offset = 0): { tag: number; start: number; end: number } {
  const tag = buf[offset]
  let len = buf[offset + 1]
  let start = offset + 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + buf[offset + 2 + i]
    start += n
  }
  return { tag, start, end: start + len }
}
