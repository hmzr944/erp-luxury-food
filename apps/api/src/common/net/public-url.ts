import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Les URL saisies par les clients (webhooks, plateforme de facturation) ne
// doivent jamais viser le réseau interne : métadonnées du cloud, base de
// données, Redis, services privés. Vérifié à l'enregistrement ET à chaque
// envoi (le DNS peut changer entre les deux).

export class UnsafeUrlError extends Error {}

const V4_BLOCKED: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
]

const v4ToInt = (ip: string) => ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip)
    return V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)))
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::' || v6 === '::1') return true
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateAddress(mapped[1])
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6)
}

export async function assertPublicUrl(raw: string, opts: { allowHttp?: boolean } = {}): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('Adresse invalide')
  }
  if (url.protocol !== 'https:' && !(opts.allowHttp && url.protocol === 'http:')) throw new UnsafeUrlError('Adresse en https:// attendue')
  if (url.username || url.password) throw new UnsafeUrlError('Identifiants interdits dans l’adresse')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new UnsafeUrlError('Adresse interne refusée')
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true }).catch(() => [])).map((a) => a.address)
  if (!addresses.length) throw new UnsafeUrlError('Nom de domaine introuvable')
  if (addresses.some(isPrivateAddress)) throw new UnsafeUrlError('Adresse interne refusée')
  return url
}
