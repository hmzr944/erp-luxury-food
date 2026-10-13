import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Logger } from '@nestjs/common'

// Chiffrement des secrets stockés en base (clés API des prestataires).
// Clé : SECRETS_KEY (32 octets en hexadécimal ou base64). En développement
// seulement, à défaut, une clé est dérivée de JWT_SECRET.

const logger = new Logger('Secrets')
let cached: Buffer | null = null

function key(): Buffer {
  if (cached) return cached
  const raw = process.env.SECRETS_KEY
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
    if (buf.length !== 32) throw new Error('SECRETS_KEY doit faire 32 octets (64 caractères hexadécimaux)')
    return (cached = buf)
  }
  if (process.env.NODE_ENV === 'production') throw new Error('SECRETS_KEY est obligatoire en production')
  logger.warn('SECRETS_KEY absente : clé de développement dérivée de JWT_SECRET')
  return (cached = createHash('sha256').update(`dev-secrets:${process.env.JWT_SECRET ?? 'dev'}`).digest())
}

// Format : v1.<iv>.<tag>.<données>, chaque partie en base64url
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Secret illisible')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

// Pour l'affichage : « sk_test_…a1b2 »
export function maskSecret(s: string): string {
  if (s.length <= 8) return '••••'
  const prefix = s.match(/^[a-z]+_(test|live)_/)?.[0] ?? ''
  return `${prefix}…${s.slice(-4)}`
}
