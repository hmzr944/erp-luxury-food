// Impression A4 sur imprimante de bureau ou AirPrint par IPP, sans pilote.
// Encodage binaire IPP/1.1 (RFC 8010) fait main, transport HTTP POST
// « application/ipp » (RFC 8010 §4). Le document est un PDF fourni par la caisse.

import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIPv4 } from 'node:net'
import { resolveLanHost } from './lan.js'
import { BridgeError } from './protocol.js'

export const DEFAULT_IPP_PORT = 631
export const DEFAULT_IPP_PATH = '/ipp/print'
// PDF de 14 Mo au plus : en base64 (x 4/3) il tient dans un message de 20 Mo
export const MAX_DOCUMENT_BYTES = 14 * 1024 * 1024
const MAX_RESPONSE_BYTES = 1024 * 1024

// Opérations
export const OP_PRINT_JOB = 0x0002
export const OP_GET_PRINTER_ATTRIBUTES = 0x000b

// Délimiteurs de groupes
export const TAG_OPERATION = 0x01
export const TAG_JOB = 0x02
export const TAG_END = 0x03
export const TAG_PRINTER = 0x04
export const TAG_UNSUPPORTED = 0x05

// Types de valeurs
export const VT_INTEGER = 0x21
export const VT_BOOLEAN = 0x22
export const VT_ENUM = 0x23
export const VT_TEXT = 0x41
export const VT_NAME = 0x42
export const VT_KEYWORD = 0x44
export const VT_URI = 0x45
export const VT_CHARSET = 0x47
export const VT_LANGUAGE = 0x48
export const VT_MIME = 0x49

export type IppValue = number | boolean | string | Buffer

export interface IppAttribute {
  tag: number
  name: string
  values: IppValue[]
}

export interface IppGroup {
  tag: number
  attributes: IppAttribute[]
}

export interface IppMessage {
  version: [number, number]
  // Opération (requête) ou statut (réponse)
  code: number
  requestId: number
  groups: IppGroup[]
  data?: Buffer
}

const isStringTag = (tag: number) => tag >= 0x41 && tag <= 0x49
const isIntTag = (tag: number) => tag === VT_INTEGER || tag === VT_ENUM

function encodeValue(tag: number, v: IppValue): Buffer {
  if (isIntTag(tag)) {
    const b = Buffer.alloc(4)
    b.writeInt32BE(Number(v), 0)
    return b
  }
  if (tag === VT_BOOLEAN) return Buffer.from([v ? 1 : 0])
  if (Buffer.isBuffer(v)) return v
  return Buffer.from(String(v), 'utf8')
}

export function encodeIpp(msg: IppMessage): Buffer {
  const parts: Buffer[] = []
  const head = Buffer.alloc(8)
  head[0] = msg.version[0]
  head[1] = msg.version[1]
  head.writeUInt16BE(msg.code, 2)
  head.writeUInt32BE(msg.requestId >>> 0, 4)
  parts.push(head)
  for (const group of msg.groups) {
    parts.push(Buffer.from([group.tag]))
    for (const attr of group.attributes) {
      attr.values.forEach((v, i) => {
        // Valeurs supplémentaires d'un même attribut : nom de longueur nulle
        const name = Buffer.from(i === 0 ? attr.name : '', 'utf8')
        const value = encodeValue(attr.tag, v)
        if (name.length > 0xffff || value.length > 0xffff) throw new Error('Attribut IPP trop long')
        const h = Buffer.alloc(3)
        h[0] = attr.tag
        h.writeUInt16BE(name.length, 1)
        const l = Buffer.alloc(2)
        l.writeUInt16BE(value.length, 0)
        parts.push(h, name, l, value)
      })
    }
  }
  parts.push(Buffer.from([TAG_END]))
  if (msg.data) parts.push(msg.data)
  return Buffer.concat(parts)
}

export function decodeIpp(buf: Buffer): IppMessage {
  if (buf.length < 9) throw new Error('Réponse IPP tronquée')
  const version: [number, number] = [buf[0], buf[1]]
  const code = buf.readUInt16BE(2)
  const requestId = buf.readUInt32BE(4)
  const groups: IppGroup[] = []
  let group: IppGroup | null = null
  let last: IppAttribute | null = null
  let pos = 8
  const need = (n: number) => {
    if (pos + n > buf.length) throw new Error('Réponse IPP tronquée')
  }
  for (;;) {
    need(1)
    const tag = buf[pos++]
    if (tag === TAG_END) break
    if (tag <= 0x0f) {
      // Nouveau groupe d'attributs
      group = { tag, attributes: [] }
      groups.push(group)
      last = null
      continue
    }
    if (!group) throw new Error('Attribut IPP hors groupe')
    need(2)
    const nameLen = buf.readUInt16BE(pos)
    pos += 2
    need(nameLen + 2)
    const name = buf.toString('utf8', pos, pos + nameLen)
    pos += nameLen
    const valueLen = buf.readUInt16BE(pos)
    pos += 2
    need(valueLen)
    const raw = buf.subarray(pos, pos + valueLen)
    pos += valueLen
    let value: IppValue
    if (isIntTag(tag) && valueLen === 4) value = raw.readInt32BE(0)
    else if (tag === VT_BOOLEAN && valueLen === 1) value = raw[0] !== 0
    else if (isStringTag(tag)) value = raw.toString('utf8')
    else value = Buffer.from(raw)
    if (nameLen === 0) {
      // Valeur supplémentaire (ou membre de collection, gardé brut)
      if (!last) throw new Error('Valeur IPP orpheline')
      last.values.push(value)
    } else {
      last = { tag, name, values: [value] }
      group.attributes.push(last)
    }
  }
  const data = pos < buf.length ? Buffer.from(buf.subarray(pos)) : undefined
  return { version, code, requestId, groups, data }
}

export function findAttribute(msg: IppMessage, name: string, groupTag?: number): IppAttribute | undefined {
  for (const g of msg.groups) {
    if (groupTag !== undefined && g.tag !== groupTag) continue
    const a = g.attributes.find((x) => x.name === name)
    if (a) return a
  }
  return undefined
}

// --- Statuts --------------------------------------------------------------

export const IPP_STATUS_NAMES: Record<number, string> = {
  0x0000: 'successful-ok',
  0x0001: 'successful-ok-ignored-or-substituted-attributes',
  0x0002: 'successful-ok-conflicting-attributes',
  0x0400: 'client-error-bad-request',
  0x0401: 'client-error-forbidden',
  0x0402: 'client-error-not-authenticated',
  0x0403: 'client-error-not-authorized',
  0x0404: 'client-error-not-possible',
  0x0405: 'client-error-timeout',
  0x0406: 'client-error-not-found',
  0x0407: 'client-error-gone',
  0x0408: 'client-error-request-entity-too-large',
  0x0409: 'client-error-request-value-too-long',
  0x040a: 'client-error-document-format-not-supported',
  0x040b: 'client-error-attributes-or-values-not-supported',
  0x040c: 'client-error-uri-scheme-not-supported',
  0x040d: 'client-error-charset-not-supported',
  0x040e: 'client-error-conflicting-attributes',
  0x040f: 'client-error-compression-not-supported',
  0x0410: 'client-error-compression-error',
  0x0411: 'client-error-document-format-error',
  0x0412: 'client-error-document-access-error',
  0x0500: 'server-error-internal-error',
  0x0501: 'server-error-operation-not-supported',
  0x0502: 'server-error-service-unavailable',
  0x0503: 'server-error-version-not-supported',
  0x0504: 'server-error-device-error',
  0x0505: 'server-error-temporary-error',
  0x0506: 'server-error-not-accepting-jobs',
  0x0507: 'server-error-busy',
  0x0508: 'server-error-job-canceled',
  0x0509: 'server-error-multiple-document-jobs-not-supported',
}

const STATUS_FR: Record<number, string> = {
  0x0401: "l'imprimante refuse l'impression",
  0x0402: "l'imprimante demande une authentification",
  0x0403: "l'imprimante demande une authentification",
  0x0404: "l'imprimante ne peut pas imprimer ce document maintenant (papier, capot ou réglages)",
  0x0406: "file d'impression introuvable, vérifiez le chemin IPP",
  0x0408: 'document trop volumineux pour cette imprimante',
  0x040a: "l'imprimante n'accepte pas ce format de document",
  0x040b: 'option non prise en charge par cette imprimante',
  0x0411: 'document illisible par l’imprimante',
  0x0502: 'service d’impression indisponible',
  0x0504: 'erreur matérielle (papier, encre ou bourrage ?)',
  0x0505: 'erreur temporaire, réessayez dans un instant',
  0x0506: "l'imprimante n'accepte plus de travaux pour l'instant",
  0x0507: "l'imprimante est occupée, réessayez dans un instant",
  0x0508: 'travail annulé sur l’imprimante',
}

const hex = (code: number) => `0x${code.toString(16).padStart(4, '0')}`

export function statusName(code: number): string {
  return IPP_STATUS_NAMES[code] ?? hex(code)
}

export function ippStatusError(code: number, label: string): BridgeError {
  const name = statusName(code)
  const detail = STATUS_FR[code] ?? (code >= 0x0500 ? "erreur de l'imprimante" : 'requête refusée')
  const errorCode =
    code === 0x040a ? 'format_unsupported' : [0x0502, 0x0505, 0x0506, 0x0507].includes(code) ? 'printer_busy' : 'ipp_error'
  return new BridgeError(errorCode, `Impression refusée par ${label} : ${detail} (${name}, ${hex(code)}).`)
}

// --- Transport --------------------------------------------------------------

export interface IppTarget {
  // Nom saisi (pour printer-uri et l'en-tête Host) et adresse résolue (connexion)
  host: string
  ip: string
  port: number
  path: string
  tls: boolean
}

export function printerUri(t: Pick<IppTarget, 'host' | 'port' | 'path' | 'tls'>): string {
  return `${t.tls ? 'ipps' : 'ipp'}://${t.host}:${t.port}${t.path}`
}

function describeNetError(err: NodeJS.ErrnoException, label: string): BridgeError {
  switch (err.code) {
    case 'ECONNREFUSED':
      return new BridgeError('printer_unreachable', `Imprimante injoignable à ${label} (connexion refusée, IPP désactivé ?).`)
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return new BridgeError('printer_unreachable', `Imprimante injoignable à ${label} (appareil absent du réseau).`)
    case 'ETIMEDOUT':
      return new BridgeError('printer_timeout', `L'imprimante ${label} ne répond pas.`)
    case 'ECONNRESET':
    case 'EPIPE':
      return new BridgeError('printer_reset', `L'imprimante ${label} a coupé la connexion pendant l'envoi.`)
    default:
      return new BridgeError('printer_error', `Erreur d'impression sur ${label} : ${err.code ?? err.message}.`)
  }
}

export function ippPost(t: IppTarget, body: Buffer, timeoutMs: number): Promise<IppMessage> {
  const label = `${t.host}:${t.port}`
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (err: BridgeError | null, msg?: IppMessage) => {
      if (done) return
      done = true
      clearTimeout(timer)
      req.destroy()
      if (err) reject(err)
      else resolve(msg!)
    }
    const options = {
      host: t.ip,
      port: t.port,
      path: t.path,
      method: 'POST',
      headers: {
        Host: `${t.host}:${t.port}`,
        'Content-Type': 'application/ipp',
        'Content-Length': body.length,
        Accept: 'application/ipp',
      },
    }
    const onResponse = (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (c: Buffer) => {
        size += c.length
        if (size > MAX_RESPONSE_BYTES) finish(new BridgeError('printer_error', `Réponse trop volumineuse de ${label}.`))
        else chunks.push(c)
      })
      res.on('error', (err) => finish(describeNetError(err, label)))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          const hint = res.statusCode === 404 ? ' Vérifiez le chemin IPP (ex. /ipp/print).' : ''
          finish(new BridgeError('printer_error', `L'imprimante ${label} a répondu HTTP ${res.statusCode}.${hint}`))
          return
        }
        try {
          finish(null, decodeIpp(Buffer.concat(chunks)))
        } catch {
          finish(new BridgeError('printer_error', `Réponse IPP illisible de ${label}.`))
        }
      })
    }
    const req = t.tls
      ? httpsRequest(
          {
            ...options,
            // Les imprimantes présentent presque toujours un certificat auto-signé
            // (créé en usine, au nom de l'appareil) : impossible à valider. Le
            // chiffrement reste utile et l'hôte est déjà limité au réseau local.
            rejectUnauthorized: false,
            servername: isIPv4(t.host) ? undefined : t.host,
          },
          onResponse,
        )
      : httpRequest(options, onResponse)
    const timer = setTimeout(
      () => finish(new BridgeError('printer_timeout', `Délai dépassé : l'imprimante ${label} ne répond pas.`)),
      timeoutMs,
    )
    req.on('error', (err) => finish(describeNetError(err, label)))
    req.end(body)
  })
}

// --- Opérations -------------------------------------------------------------

let nextRequestId = 1

function operationGroup(t: IppTarget, extra: IppAttribute[] = []): IppGroup {
  return {
    tag: TAG_OPERATION,
    attributes: [
      // L'ordre des deux premiers attributs est imposé par la RFC 8011
      { tag: VT_CHARSET, name: 'attributes-charset', values: ['utf-8'] },
      { tag: VT_LANGUAGE, name: 'attributes-natural-language', values: ['fr'] },
      { tag: VT_URI, name: 'printer-uri', values: [printerUri(t)] },
      { tag: VT_NAME, name: 'requesting-user-name', values: ['FLOW'] },
      ...extra,
    ],
  }
}

export function buildGetPrinterAttributes(t: IppTarget, requestId = nextRequestId++): Buffer {
  return encodeIpp({
    version: [1, 1],
    code: OP_GET_PRINTER_ATTRIBUTES,
    requestId,
    groups: [
      operationGroup(t, [
        {
          tag: VT_KEYWORD,
          name: 'requested-attributes',
          values: ['document-format-supported', 'printer-state', 'printer-make-and-model'],
        },
      ]),
    ],
  })
}

export function buildPrintJob(t: IppTarget, pdf: Buffer, jobName: string, copies: number, requestId = nextRequestId++): Buffer {
  const groups: IppGroup[] = [
    operationGroup(t, [
      { tag: VT_NAME, name: 'job-name', values: [jobName] },
      { tag: VT_MIME, name: 'document-format', values: ['application/pdf'] },
    ]),
  ]
  if (copies > 1) groups.push({ tag: TAG_JOB, attributes: [{ tag: VT_INTEGER, name: 'copies', values: [copies] }] })
  return encodeIpp({ version: [1, 1], code: OP_PRINT_JOB, requestId, groups, data: pdf })
}

export interface PrintDocumentOptions {
  host: string
  port?: number
  path?: string
  tls?: boolean
  pdf: Buffer
  jobName?: string
  copies?: number
  timeoutMs?: number
}

export interface PrintDocumentResult {
  ok: true
  jobId?: number
  printer?: string
}

export function normalizePath(path: string | undefined): string {
  const p = (path ?? DEFAULT_IPP_PATH).trim()
  if (!p) return DEFAULT_IPP_PATH
  return p.startsWith('/') ? p : `/${p}`
}

export async function printDocument(o: PrintDocumentOptions): Promise<PrintDocumentResult> {
  const ip = await resolveLanHost(o.host)
  const t: IppTarget = {
    host: o.host.trim().toLowerCase(),
    ip,
    port: o.port ?? DEFAULT_IPP_PORT,
    path: normalizePath(o.path),
    tls: o.tls ?? false,
  }
  const label = `${t.host}:${t.port}`
  const timeoutMs = o.timeoutMs ?? 30_000

  // 1. L'imprimante accepte-t-elle le PDF ?
  const attrs = await ippPost(t, buildGetPrinterAttributes(t), Math.min(timeoutMs, 10_000))
  if (attrs.code >= 0x0100) throw ippStatusError(attrs.code, label)
  const formats = findAttribute(attrs, 'document-format-supported')?.values.map((v) => String(v).toLowerCase())
  const model = findAttribute(attrs, 'printer-make-and-model')?.values[0]
  const printer = typeof model === 'string' && model ? model : undefined
  if (formats && formats.length > 0 && !formats.includes('application/pdf')) {
    throw new BridgeError(
      'format_unsupported',
      `L'imprimante ${printer ?? label} n'accepte pas les documents PDF. Imprimez depuis la fenêtre d'impression du navigateur.`,
    )
  }

  // 2. Envoi du travail
  const jobName = (o.jobName ?? '').trim().slice(0, 255) || 'FLOW'
  const res = await ippPost(t, buildPrintJob(t, o.pdf, jobName, o.copies ?? 1), timeoutMs)
  if (res.code >= 0x0100) throw ippStatusError(res.code, printer ?? label)
  const jobId = findAttribute(res, 'job-id', TAG_JOB)?.values[0]
  return { ok: true, ...(typeof jobId === 'number' ? { jobId } : {}), ...(printer ? { printer } : {}) }
}
