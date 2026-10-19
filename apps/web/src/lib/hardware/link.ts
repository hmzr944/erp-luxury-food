// Lien d'appairage ouvert par FLŌW-Bridge (/materiel#pont=<CODE6>&port=<PORT>)
// et retour après connexion. Le fragment ne part jamais au serveur ; on le
// garde dans l'onglet le temps de se connecter, puis on l'efface de l'URL.

import { parsePairingFragment, safeReturnPath, type PairingLink } from './wizard'

const LINK_KEY = 'flow-bridge-pairing-link'
const RETURN_KEY = 'flow-return-to'
// Le code affiché par le pont ne vit pas longtemps : au-delà, saisie manuelle
const LINK_TTL_MS = 10 * 60_000

function session(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

// Lit le lien (fragment de l'URL ou onglet) sans le consommer : l'appel peut
// se répéter (double rendu en développement). Le fragment est retiré de
// l'URL dès la première lecture pour ne pas rester dans l'historique.
export function readPairingLink(): PairingLink | null {
  if (typeof window === 'undefined') return null
  const fromHash = parsePairingFragment(window.location.hash)
  if (fromHash) {
    stashPairingLink(fromHash)
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    return fromHash
  }
  try {
    const raw = session()?.getItem(LINK_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as PairingLink & { at: number }
    if (Date.now() - saved.at > LINK_TTL_MS) {
      clearPairingLink()
      return null
    }
    return { code: saved.code, port: saved.port }
  } catch {
    return null
  }
}

export function stashPairingLink(link: PairingLink) {
  try {
    session()?.setItem(LINK_KEY, JSON.stringify({ ...link, at: Date.now() }))
  } catch {
    // Stockage bloqué : le code se saisira à la main
  }
}

// Fragment présent dans l'URL courante : on le met de côté avant une redirection
export function stashPairingFragment() {
  if (typeof window === 'undefined') return
  const link = parsePairingFragment(window.location.hash)
  if (link) stashPairingLink(link)
}

export function hasPairingLink(): boolean {
  return readPairingLink() !== null
}

export function clearPairingLink() {
  try {
    session()?.removeItem(LINK_KEY)
  } catch {
    // rien à effacer
  }
}

// Page demandée avant la connexion, fragment compris
export function rememberReturnTo(path: string) {
  const safe = safeReturnPath(path)
  if (!safe) return
  try {
    session()?.setItem(RETURN_KEY, safe)
  } catch {
    // Sans stockage, retour à l'accueil de l'espace
  }
}

export function takeReturnTo(): string | null {
  try {
    const s = session()
    const value = s?.getItem(RETURN_KEY) ?? null
    s?.removeItem(RETURN_KEY)
    return safeReturnPath(value)
  } catch {
    return null
  }
}
