// Types du protocole FLŌW-Bridge, alignés sur apps/bridge/src/server.ts.
// Dupliqués ici exprès : la caisse ne dépend pas du code Node du pont.

export type BridgeStatus = 'off' | 'connecting' | 'unpaired' | 'ready'

export interface BridgeErrorBody {
  code: string
  // Message en français, affichable tel quel au vendeur
  message: string
}

export interface BridgeInfo {
  name: string
  version: string
  capabilities: string[]
  platform: string
  arch: string
  node: string
}

export interface PairParams {
  code: string
  name: string
}
export interface PairResult {
  token: string
  clientId: string
  name: string
}

export interface HelloResult {
  clientId: string
  name: string
  version: string
  capabilities: string[]
}

export interface PrinterPrintParams {
  host: string
  port?: number
  // Octets ESC/POS bruts encodés en base64
  data: string
  timeoutMs?: number
}
export interface PrinterPrintResult {
  ok: true
  bytes: number
}

export interface PrinterProbeParams {
  host: string
  port?: number
  timeoutMs?: number
}
export interface PrinterProbeResult {
  reachable: boolean
  latencyMs: number | null
  message?: string
}

export interface DrawerOpenParams {
  host: string
  port?: number
  // 0 = broche 2 (cas usuel), 1 = broche 5
  pin?: 0 | 1
  timeoutMs?: number
}

export type PaymentAdapterName = 'simulator' | 'caisse-ap'

export interface PaymentStartParams {
  adapter: PaymentAdapterName
  amountCents: number
  currency?: string
  reference?: string
  // Identifiant choisi par la caisse, pour pouvoir annuler sans attendre
  paymentId?: string
  // Caisse-AP uniquement
  host?: string
  port?: number
  posNumber?: string
  mode?: 'card' | 'check'
  refund?: boolean
  timeoutMs?: number
}

export type PaymentStatus = 'approved' | 'declined' | 'cancelled' | 'error'

export interface PaymentResult {
  paymentId: string
  status: PaymentStatus
  message?: string
  authorizationCode?: string
  maskedPan?: string
  cardType?: string
  transactionId?: string
  receiptText?: string
  raw?: unknown
}

export interface PaymentProgress {
  paymentId: string
  step: string
  message: string
}

export interface PaymentCancelResult {
  accepted: boolean
  message: string
}

export interface PaymentStatusResult {
  state: 'pending' | 'done' | 'unknown'
  result?: PaymentResult
}

// Correspondance méthode -> paramètres / résultat, pour typer call()
export interface BridgeMethods {
  'bridge.pair': [PairParams, PairResult]
  'bridge.hello': [{ token: string }, HelloResult]
  'bridge.unpair': [undefined, { ok: true }]
  'bridge.info': [undefined, BridgeInfo]
  'printer.print': [PrinterPrintParams, PrinterPrintResult]
  'printer.probe': [PrinterProbeParams, PrinterProbeResult]
  'drawer.open': [DrawerOpenParams, { ok: true }]
  'payment.start': [PaymentStartParams, PaymentResult]
  'payment.cancel': [{ paymentId: string }, PaymentCancelResult]
  'payment.status': [{ paymentId: string }, PaymentStatusResult]
}

export interface BridgeEvents {
  'payment.progress': PaymentProgress
}

// Code de fermeture envoyé par le pont quand l'origine du site n'est pas autorisée
export const CLOSE_ORIGIN_REFUSED = 4003
