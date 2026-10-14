// Le pont ne parle qu'au matériel du magasin. Sans ce garde-fou, une caisse
// appairée (ou un poste compromis) pourrait s'en servir comme relais TCP
// vers n'importe quelle machine d'Internet.

import { lookup } from 'node:dns/promises'
import { isIPv4 } from 'node:net'
import { BridgeError } from './protocol.js'

function octets(ip: string): number[] {
  return ip.split('.').map((n) => Number(n))
}

// Adresses IPv4 non routables sur Internet : réseaux privés RFC 1918,
// boucle locale et lien local (imprimantes en adressage automatique).
export function isPrivateIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false
  const [a, b] = octets(ip)
  if (a === 10) return true
  if (a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

// Nom acceptable a priori : adresse privée, « localhost » ou nom mDNS en .local
export function isLanHostSyntax(host: string): boolean {
  const h = host.trim().toLowerCase()
  if (isIPv4(h)) return isPrivateIPv4(h)
  if (h === 'localhost') return true
  return /^[a-z0-9]([a-z0-9-]{0,62})(\.[a-z0-9]([a-z0-9-]{0,62}))*\.local$/.test(h)
}

// Valide puis résout l'hôte. On vérifie aussi l'adresse obtenue : un nom
// en .local qui pointerait vers une IP publique est refusé.
export async function resolveLanHost(host: string): Promise<string> {
  const h = host.trim().toLowerCase()
  if (!isLanHostSyntax(h)) {
    throw new BridgeError(
      'host_not_allowed',
      `Adresse refusée : ${host}. Seules les adresses du réseau local (192.168.x.x, 10.x.x.x, 172.16-31.x.x) ou les noms en .local sont acceptés.`,
    )
  }
  if (isIPv4(h)) return h
  let address: string
  try {
    address = (await lookup(h, { family: 4 })).address
  } catch {
    throw new BridgeError('host_unresolved', `Appareil introuvable sur le réseau : ${host}.`)
  }
  if (!isPrivateIPv4(address)) {
    throw new BridgeError('host_not_allowed', `Adresse refusée : ${host} pointe hors du réseau local (${address}).`)
  }
  return address
}
