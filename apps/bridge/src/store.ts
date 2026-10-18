// Caisses appairées, dans ~/.flow-bridge/config.json (ou FLOW_BRIDGE_HOME).
// On ne garde que l'empreinte SHA-256 des jetons : un fichier de config
// copié ou sauvegardé ne permet pas de se faire passer pour une caisse.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface PairedClient {
  id: string
  name: string
  tokenHash: string
  createdAt: string
  lastSeenAt?: string
}

interface ConfigFile {
  version: 1
  clients: PairedClient[]
  // Pont ouvert aux iPad du réseau local (« flow-bridge reseau oui »)
  lan?: boolean
}

// Code d'appairage demandé par « flow-bridge pair » alors que le service
// tourne déjà : il passe par ce fichier, lisible seulement par l'utilisateur local.
export interface PendingPairing {
  codeHash: string
  expiresAt: number
}

export function defaultHome(): string {
  return process.env.FLOW_BRIDGE_HOME || join(homedir(), '.flow-bridge')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

function writeAtomic(path: string, content: string) {
  // Écriture atomique : un arrêt brutal ne laisse jamais un fichier à moitié écrit
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, content, { mode: 0o600 })
  renameSync(tmp, path)
}

export class ConfigStore {
  readonly configPath: string
  readonly pairingPath: string

  constructor(readonly home: string = defaultHome()) {
    mkdirSync(home, { recursive: true, mode: 0o700 })
    this.configPath = join(home, 'config.json')
    this.pairingPath = join(home, 'pairing.json')
  }

  private read(): ConfigFile {
    try {
      const raw = JSON.parse(readFileSync(this.configPath, 'utf8')) as Partial<ConfigFile>
      return { version: 1, clients: Array.isArray(raw.clients) ? raw.clients : [], ...(raw.lan === true ? { lan: true } : {}) }
    } catch {
      return { version: 1, clients: [] }
    }
  }

  private write(cfg: ConfigFile) {
    writeAtomic(this.configPath, JSON.stringify(cfg, null, 2) + '\n')
  }

  listClients(): PairedClient[] {
    return this.read().clients
  }

  hasClients(): boolean {
    return this.read().clients.length > 0
  }

  addClient(name: string): { client: PairedClient; token: string } {
    const token = newToken()
    const client: PairedClient = {
      id: randomUUID(),
      name,
      tokenHash: sha256(token),
      createdAt: new Date().toISOString(),
    }
    const cfg = this.read()
    cfg.clients.push(client)
    this.write(cfg)
    return { client, token }
  }

  // Comparaison à temps constant des empreintes
  findByToken(token: string): PairedClient | undefined {
    const hash = Buffer.from(sha256(token), 'hex')
    let found: PairedClient | undefined
    for (const c of this.read().clients) {
      const other = Buffer.from(c.tokenHash, 'hex')
      if (other.length === hash.length && timingSafeEqual(other, hash)) found = c
    }
    return found
  }

  touch(id: string) {
    const cfg = this.read()
    const c = cfg.clients.find((x) => x.id === id)
    if (!c) return
    c.lastSeenAt = new Date().toISOString()
    this.write(cfg)
  }

  removeClient(id: string): boolean {
    const cfg = this.read()
    const before = cfg.clients.length
    cfg.clients = cfg.clients.filter((c) => c.id !== id)
    if (cfg.clients.length === before) return false
    this.write(cfg)
    return true
  }

  getLan(): boolean {
    return this.read().lan === true
  }

  setLan(enabled: boolean) {
    const cfg = this.read()
    if (enabled) cfg.lan = true
    else delete cfg.lan
    this.write(cfg)
  }

  readPendingPairing(): PendingPairing | null {
    try {
      const p = JSON.parse(readFileSync(this.pairingPath, 'utf8')) as PendingPairing
      if (typeof p.codeHash !== 'string' || typeof p.expiresAt !== 'number') return null
      return p
    } catch {
      return null
    }
  }

  writePendingPairing(p: PendingPairing) {
    writeAtomic(this.pairingPath, JSON.stringify(p) + '\n')
  }

  clearPendingPairing() {
    rmSync(this.pairingPath, { force: true })
  }
}
