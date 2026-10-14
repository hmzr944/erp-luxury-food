// Protocole entre la caisse et le pont : du JSON façon JSON-RPC sur WebSocket.
// Requête {id, method, params} ; réponse {id, result} ou {id, error} ;
// événement poussé par le pont {event, data}.

export interface RpcRequest {
  id: string | number
  method: string
  params?: unknown
}

export interface RpcErrorBody {
  code: string
  // Message en français, affichable tel quel au vendeur
  message: string
}

export type RpcResponse =
  | { id: string | number | null; result: unknown }
  | { id: string | number | null; error: RpcErrorBody }

export interface RpcEvent {
  event: string
  data: unknown
}

// Erreur « métier » : son code et son message partent tels quels vers la caisse.
// Toute autre exception est masquée derrière une erreur interne générique.
export class BridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Petits validateurs de paramètres : messages clairs plutôt qu'un plantage
export function requireParams(params: unknown): Record<string, unknown> {
  if (params === undefined || params === null) return {}
  if (!isRecord(params)) throw new BridgeError('invalid_params', 'Paramètres invalides.')
  return params
}

export function str(p: Record<string, unknown>, key: string, opts: { required?: boolean; max?: number } = {}): string | undefined {
  const v = p[key]
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new BridgeError('invalid_params', `Paramètre « ${key} » manquant.`)
    return undefined
  }
  if (typeof v !== 'string') throw new BridgeError('invalid_params', `Paramètre « ${key} » invalide.`)
  if (opts.max && v.length > opts.max) throw new BridgeError('invalid_params', `Paramètre « ${key} » trop long.`)
  return v
}

export function int(
  p: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number; def?: number; required?: boolean } = {},
): number {
  const v = p[key]
  if (v === undefined || v === null) {
    if (opts.def !== undefined && !opts.required) return opts.def
    throw new BridgeError('invalid_params', `Paramètre « ${key} » manquant.`)
  }
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new BridgeError('invalid_params', `Paramètre « ${key} » invalide (entier attendu).`)
  }
  if ((opts.min !== undefined && v < opts.min) || (opts.max !== undefined && v > opts.max)) {
    throw new BridgeError('invalid_params', `Paramètre « ${key} » hors limites.`)
  }
  return v
}

export function bool(p: Record<string, unknown>, key: string, def: boolean): boolean {
  const v = p[key]
  if (v === undefined || v === null) return def
  if (typeof v !== 'boolean') throw new BridgeError('invalid_params', `Paramètre « ${key} » invalide (vrai ou faux attendu).`)
  return v
}
