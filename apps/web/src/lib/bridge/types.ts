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
  // Pont 0.2 et suivants
  network?: BridgeNetwork
}

// Connexion sécurisée et accès des iPad (bridge.info, bridge.setLan)
export interface BridgeNetwork {
  lan: boolean
  tls: boolean
  port: number
  // Adresses IPv4 du pont sur le réseau du magasin, quand l'accès est ouvert
  addresses: string[]
  certificate: { fingerprint: string; label: string; paths: { profile: string; cer: string; pem: string } } | null
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
// État lu par le pont avant le ticket (ESC/POS DLE EOT). known: false :
// l'imprimante ne donne pas son état, le ticket est parti sans confirmation.
export interface PrinterStatus {
  known: boolean
  online?: boolean
  coverOpen?: boolean
  paperEnd?: boolean
  paperNearEnd?: boolean
  error?: boolean
  cutterError?: boolean
  unrecoverable?: boolean
  raw: number[]
}
// Sans papier, capot ouvert, hors ligne ou en erreur, l'appel échoue avec
// printer_no_paper, printer_cover_open, printer_offline ou printer_error.
// status et warning manquent avec un pont antérieur à la lecture d'état.
export interface PrinterPrintResult {
  ok: true
  bytes: number
  status?: PrinterStatus
  // « Papier presque fini » : le ticket est parti
  warning?: string
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

export type PrinterProtocol = 'escpos' | 'ipp' | 'ipps'

export interface PrinterDiscoverParams {
  // Durée d'écoute mDNS : 2500 par défaut, 10000 au plus
  timeoutMs?: number
  // Balayage du port 9100 sur le /24 privé du pont (true par défaut)
  scan?: boolean
}
export interface DiscoveredPrinter {
  name: string
  // Adresse IPv4 du réseau local
  host: string
  // Port du protocole principal (9100 si ESC/POS, sinon IPP)
  port: number
  // Vide si l'appareil n'annonce que LPD (port 515)
  protocols: PrinterProtocol[]
  // Port IPP/IPPS annoncé, à passer à printer.printDocument
  ippPort?: number
  model?: string
  airprint?: boolean
  // Chemin IPP annoncé (TXT rp), à passer en path
  rp?: string
  source: 'mdns' | 'scan'
}
export interface PrinterDiscoverResult {
  printers: DiscoveredPrinter[]
}

// Le pont peut mettre jusqu'à timeoutMs (30 s par défaut) plus 10 s de
// vérification : appeler call() avec un délai plus long que les 15 s par défaut,
// ex. call('printer.printDocument', params, 60_000).
export interface PrinterPrintDocumentParams {
  host: string
  // 631 par défaut
  port?: number
  // '/ipp/print' par défaut, ou le rp de la découverte
  path?: string
  // IPPS (certificat auto-signé de l'imprimante accepté)
  tls?: boolean
  // PDF encodé en base64 (14 Mo au plus)
  data: string
  jobName?: string
  // 1 à 20
  copies?: number
  timeoutMs?: number
}
export interface PrinterPrintDocumentResult {
  ok: true
  jobId?: number
  // Marque et modèle annoncés par l'imprimante
  printer?: string
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
  'bridge.setLan': [{ enabled: boolean }, BridgeNetwork]
  'printer.print': [PrinterPrintParams, PrinterPrintResult]
  'printer.probe': [PrinterProbeParams, PrinterProbeResult]
  'printer.status': [PrinterProbeParams, PrinterStatus]
  'printer.discover': [PrinterDiscoverParams | undefined, PrinterDiscoverResult]
  'printer.printDocument': [PrinterPrintDocumentParams, PrinterPrintDocumentResult]
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
// Connexion en clair refusée depuis le réseau local (wss exigé)
export const CLOSE_INSECURE_LAN = 4004
