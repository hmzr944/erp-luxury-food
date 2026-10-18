// Certificats TLS du pont, fabriqués sur place sans bibliothèque externe.
//
// Safari (Mac, iPad, iPhone) refuse ws:// depuis une caisse servie en https
// et refuse un wss:// dont le certificat n'est pas approuvé. Le pont crée
// donc, une fois pour toutes, sa propre autorité de certification :
// « FLŌW-Bridge (nom de l'ordinateur) ». Le commerçant l'approuve une fois
// sur chaque appareil Apple ; le certificat du serveur, signé par elle, peut
// ensuite être renouvelé librement (nouvelle adresse IP, échéance proche)
// sans rien redemander.
//
// Garde-fous :
// - la clé privée de l'autorité reste dans le dossier du pont (droits 0600),
//   elle n'est jamais transmise ;
// - l'autorité porte une extension critique « Name Constraints » : elle ne
//   peut certifier que localhost, les noms en .local et les adresses privées.
//   Une clé volée ne permet donc pas de se faire passer pour un site public
//   auprès d'un système qui applique ces contraintes. Le trustd d'Apple les
//   applique aussi aux autorités approuvées par l'utilisateur (code publié :
//   apple-oss-distributions/Security, trust/trustd/SecPolicyServer.c et
//   nameconstraints.c) ; à vérifier sur un vrai appareil, voir
//   docs/flow-bridge-securite.md.

import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign, X509Certificate, type KeyObject } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { hostname, networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { isIPv4 } from 'node:net'
import {
  bitString,
  boolean,
  explicit,
  implicitConstructed,
  implicitPrimitive,
  integer,
  namedBits,
  octetString,
  oid,
  readElement,
  sequence,
  set,
  time,
  utf8String,
  type Der,
} from './der.js'

const DAY = 24 * 3600 * 1000
// Autorité : dix ans, elle n'est approuvée qu'une fois
export const CA_DAYS = 3650
// Apple refuse les certificats TLS de plus de 825 jours (iOS 13, macOS 10.15) ;
// 397 jours respectent aussi la règle plus stricte des autorités publiques
export const SERVER_DAYS = 397
// Renouvellement automatique du certificat serveur à moins de 30 jours de l'échéance
export const RENEW_BEFORE_DAYS = 30

const OID = {
  ecPublicKey: '1.2.840.10045.2.1',
  ecdsaSha256: '1.2.840.10045.4.3.2',
  commonName: '2.5.4.3',
  organization: '2.5.4.10',
  basicConstraints: '2.5.29.19',
  keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37',
  subjectAltName: '2.5.29.17',
  nameConstraints: '2.5.29.30',
  subjectKeyId: '2.5.29.14',
  authorityKeyId: '2.5.29.35',
  serverAuth: '1.3.6.1.5.5.7.3.1',
}

// Adresses que l'autorité a le droit de certifier (adresse, masque)
export const PERMITTED_IPV4: Array<[string, string]> = [
  ['127.0.0.0', '255.0.0.0'],
  ['10.0.0.0', '255.0.0.0'],
  ['172.16.0.0', '255.240.0.0'],
  ['192.168.0.0', '255.255.0.0'],
  // Lien local : iPad relié directement à l'ordinateur, sans box
  ['169.254.0.0', '255.255.0.0'],
]
// Sans contrainte IPv6, toute adresse IPv6 serait permise (RFC 5280) :
// boucle locale, lien local et adresses privées (ULA) seulement
export const PERMITTED_IPV6: Array<[string, number]> = [
  ['::1', 128],
  ['fe80::', 10],
  ['fc00::', 7],
]
// « local » couvre tous les noms en .local (mDNS / Bonjour)
export const PERMITTED_DNS = ['localhost', 'local']

function ipv4Bytes(ip: string): Buffer {
  return Buffer.from(ip.split('.').map((n) => Number(n)))
}

function ipv6Bytes(ip: string): Buffer {
  const [head, tail = ''] = ip.includes('::') ? ip.split('::') : [ip, '']
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h
  if (groups.length !== 8) throw new Error(`Adresse IPv6 invalide : ${ip}`)
  const out = Buffer.alloc(16)
  groups.forEach((g, i) => out.writeUInt16BE(parseInt(g, 16), i * 2))
  return out
}

function prefixMask(bits: number, bytes: number): Buffer {
  const out = Buffer.alloc(bytes)
  for (let i = 0; i < bits; i++) out[Math.floor(i / 8)] |= 0x80 >> i % 8
  return out
}

export function isPermittedIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false
  const a = ipv4Bytes(ip)
  return PERMITTED_IPV4.some(([net, mask]) => {
    const n = ipv4Bytes(net)
    const m = ipv4Bytes(mask)
    return a.every((b, i) => (b & m[i]) === n[i])
  })
}

// --- Noms couverts par le certificat serveur -----------------------------

export interface LocalNames {
  dns: string[]
  ips: string[]
}

// Nom Bonjour de l'ordinateur : « MacBook-de-Marie.local » → « macbook-de-marie.local »
export function mdnsName(host = hostname()): string | null {
  const base = host.trim().toLowerCase().replace(/\.local\.?$/, '').split('.')[0]
  const clean = base.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)
  return clean ? `${clean}.local` : null
}

// Adresses IPv4 privées de l'ordinateur sur le réseau du magasin
export function lanIPv4(): string[] {
  const out = new Set<string>()
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPermittedIPv4(a.address) && !a.address.startsWith('127.')) out.add(a.address)
    }
  }
  return [...out].sort()
}

// Seuls des noms permis par l'autorité : un seul nom hors contraintes et
// tout le certificat serait refusé
export function currentLocalNames(host = hostname(), lan = lanIPv4()): LocalNames {
  const dns = ['localhost']
  const m = mdnsName(host)
  if (m) dns.push(m)
  return { dns, ips: ['127.0.0.1', '::1', ...lan.filter(isPermittedIPv4)] }
}

// --- Fabrication des certificats -----------------------------------------

function algorithm(): Der {
  return sequence(oid(OID.ecdsaSha256))
}

function name(cn: string): Der {
  return sequence(
    set(sequence(oid(OID.organization), utf8String('FLŌW'))),
    set(sequence(oid(OID.commonName), utf8String(cn.slice(0, 64)))),
  )
}

function extension(id: string, critical: boolean, value: Der): Der {
  return critical ? sequence(oid(id), boolean(true), octetString(value)) : sequence(oid(id), octetString(value))
}

function spkiDer(key: KeyObject): Buffer {
  return key.export({ type: 'spki', format: 'der' })
}

// Identifiant de clé (RFC 5280, 4.2.1.2, méthode 1) : SHA-1 de la clé publique brute
function keyId(spki: Buffer): Buffer {
  const outer = readElement(spki)
  const alg = readElement(spki, outer.start)
  const bits = readElement(spki, alg.end)
  return createHash('sha1').update(spki.subarray(bits.start + 1, bits.end)).digest()
}

function serial(): Buffer {
  const b = randomBytes(16)
  b[0] = (b[0] & 0x7f) | 0x01
  return b
}

function signCertificate(tbs: Der, signer: KeyObject): Buffer {
  const signature = sign('sha256', tbs, { key: signer, dsaEncoding: 'der' })
  return sequence(tbs, algorithm(), bitString(signature))
}

function toPem(der: Buffer, label = 'CERTIFICATE'): string {
  const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n').replace(/\n$/, '')
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`
}

export function nameConstraintsExtension(): Der {
  const subtrees = [
    ...PERMITTED_DNS.map((d) => sequence(implicitPrimitive(2, Buffer.from(d, 'ascii')))),
    ...PERMITTED_IPV4.map(([ip, mask]) => sequence(implicitPrimitive(7, Buffer.concat([ipv4Bytes(ip), ipv4Bytes(mask)])))),
    ...PERMITTED_IPV6.map(([ip, bits]) => sequence(implicitPrimitive(7, Buffer.concat([ipv6Bytes(ip), prefixMask(bits, 16)])))),
  ]
  return sequence(implicitConstructed(0, ...subtrees))
}

export function caLabel(host = hostname()): string {
  const machine = host.trim().replace(/\.local\.?$/i, '') || 'ordinateur'
  return `FLŌW-Bridge (${machine})`.slice(0, 64)
}

export interface Pair {
  certPem: string
  keyPem: string
}

export function createAuthority(label = caLabel(), now = new Date()): Pair {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const spki = spkiDer(publicKey)
  const subject = name(label)
  const tbs = sequence(
    explicit(0, integer(2)),
    integer(serial()),
    algorithm(),
    subject,
    sequence(time(new Date(now.getTime() - 3600_000)), time(new Date(now.getTime() + CA_DAYS * DAY))),
    subject,
    spki,
    explicit(
      3,
      sequence(
        // Autorité racine, sans autorité intermédiaire possible
        extension(OID.basicConstraints, true, sequence(boolean(true), integer(0))),
        extension(OID.keyUsage, true, namedBits([5, 6])), // keyCertSign, cRLSign
        extension(OID.subjectKeyId, false, octetString(keyId(spki))),
        // Restreint aussi l'usage de la chaîne aux serveurs TLS
        extension(OID.extKeyUsage, false, sequence(oid(OID.serverAuth))),
        extension(OID.nameConstraints, true, nameConstraintsExtension()),
      ),
    ),
  )
  const der = signCertificate(tbs, privateKey)
  return { certPem: toPem(der), keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string }
}

export function createServerCertificate(ca: Pair, names: LocalNames, now = new Date(), days = SERVER_DAYS): Pair {
  const caCert = new X509Certificate(ca.certPem)
  const caKey = createPrivateKey(ca.keyPem)
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const spki = spkiDer(publicKey)
  const caSpki = spkiDer(caCert.publicKey)
  // Émetteur recopié octet pour octet depuis le certificat de l'autorité
  const caTbs = readElement(caCert.raw)
  let p = readElement(caCert.raw, caTbs.start).start
  const fields: Array<{ start: number; end: number }> = []
  while (fields.length < 6) {
    const e = readElement(caCert.raw, p)
    fields.push({ start: p, end: e.end })
    p = e.end
  }
  // version, série, algorithme, émetteur, validité, sujet
  const caSubject = caCert.raw.subarray(fields[5].start, fields[5].end)

  const san = sequence(
    ...names.dns.map((d) => implicitPrimitive(2, Buffer.from(d, 'ascii'))),
    ...names.ips.map((ip) => implicitPrimitive(7, isIPv4(ip) ? ipv4Bytes(ip) : ipv6Bytes(ip))),
  )
  const tbs = sequence(
    explicit(0, integer(2)),
    integer(serial()),
    algorithm(),
    caSubject,
    sequence(time(new Date(now.getTime() - 3600_000)), time(new Date(now.getTime() + days * DAY))),
    sequence(set(sequence(oid(OID.commonName), utf8String('FLŌW-Bridge')))),
    spki,
    explicit(
      3,
      sequence(
        extension(OID.basicConstraints, true, sequence()),
        extension(OID.keyUsage, true, namedBits([0])), // digitalSignature
        extension(OID.extKeyUsage, false, sequence(oid(OID.serverAuth))),
        extension(OID.subjectAltName, false, san),
        extension(OID.subjectKeyId, false, octetString(keyId(spki))),
        extension(OID.authorityKeyId, false, sequence(implicitPrimitive(0, keyId(caSpki)))),
      ),
    ),
  )
  const der = signCertificate(tbs, caKey)
  return { certPem: toPem(der), keyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string }
}

// Empreinte SHA-256 « AB:CD:… », celle qu'affichent Trousseaux d'accès et iOS
export function fingerprint(certPem: string | Buffer): string {
  return new X509Certificate(certPem).fingerprint256
}

// --- Stockage et renouvellement ------------------------------------------

export interface TlsMaterial {
  cert: Buffer
  key: Buffer
  // Autorité à installer sur les appareils (absente si FLOW_BRIDGE_CERT est fourni)
  ca?: { pem: string; der: Buffer; fingerprint: string; label: string }
  names?: LocalNames
  validTo?: Date
}

export interface CertificateFiles {
  dir: string
  caCert: string
  caKey: string
  serverCert: string
  serverKey: string
}

export function certificateFiles(home: string): CertificateFiles {
  const dir = join(home, 'tls')
  return {
    dir,
    caCert: join(dir, 'autorite.pem'),
    caKey: join(dir, 'autorite-cle.pem'),
    serverCert: join(dir, 'serveur.pem'),
    serverKey: join(dir, 'serveur-cle.pem'),
  }
}

function writeSecret(path: string, content: string, mode: number) {
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, content, { mode })
  renameSync(tmp, path)
  // writeFileSync ne change pas les droits d'un fichier existant
  try {
    chmodSync(path, mode)
  } catch {
    // Windows : les droits POSIX n'existent pas, le dossier du profil protège
  }
}

function readPair(cert: string, key: string): Pair | null {
  try {
    return { certPem: readFileSync(cert, 'utf8'), keyPem: readFileSync(key, 'utf8') }
  } catch {
    return null
  }
}

function sanText(names: LocalNames): string[] {
  return [...names.dns.map((d) => `DNS:${d}`), ...names.ips.map((ip) => `IP Address:${ip === '::1' ? '0:0:0:0:0:0:0:1' : ip}`)]
}

// Le certificat serveur couvre-t-il encore les noms actuels, est-il signé par
// cette autorité, loin de l'échéance ?
export function serverNeedsRenewal(server: Pair, ca: Pair, names: LocalNames, now = new Date()): string | null {
  let cert: X509Certificate
  let caCert: X509Certificate
  try {
    cert = new X509Certificate(server.certPem)
    caCert = new X509Certificate(ca.certPem)
    if (!cert.checkPrivateKey(createPrivateKey(server.keyPem))) return 'clé du serveur incohérente'
  } catch {
    return 'certificat serveur illisible'
  }
  if (!cert.checkIssued(caCert) || !cert.verify(caCert.publicKey)) return 'autorité changée'
  if (new Date(cert.validTo).getTime() - now.getTime() < RENEW_BEFORE_DAYS * DAY) return 'échéance proche'
  if (new Date(cert.validFrom).getTime() > now.getTime() + 3600_000) return 'horloge modifiée'
  const have = new Set((cert.subjectAltName ?? '').split(', '))
  const missing = sanText(names).filter((n) => !have.has(n))
  if (missing.length) return `nouvelle adresse (${missing.join(', ')})`
  return null
}

export interface EnsureOptions {
  now?: Date
  names?: LocalNames
  host?: string
  // Recrée aussi l'autorité (elle devra être approuvée à nouveau)
  renewAuthority?: boolean
  onRenew?: (what: 'autorite' | 'serveur', reason: string) => void
}

// Lit les certificats du dossier du pont, les crée ou les renouvelle si besoin
export function ensureCertificates(home: string, opts: EnsureOptions = {}): TlsMaterial {
  const files = certificateFiles(home)
  mkdirSync(files.dir, { recursive: true, mode: 0o700 })
  const now = opts.now ?? new Date()
  const names = opts.names ?? currentLocalNames(opts.host)

  let ca = opts.renewAuthority ? null : readPair(files.caCert, files.caKey)
  const firstRun = !opts.renewAuthority && !ca
  if (ca) {
    try {
      const c = new X509Certificate(ca.certPem)
      if (!c.ca || !c.checkPrivateKey(createPrivateKey(ca.keyPem))) ca = null
      else if (new Date(c.validTo).getTime() - now.getTime() < SERVER_DAYS * DAY) ca = null
    } catch {
      ca = null
    }
  }
  if (!ca) {
    ca = createAuthority(caLabel(opts.host), now)
    writeSecret(files.caKey, ca.keyPem, 0o600)
    writeSecret(files.caCert, ca.certPem, 0o644)
    rmSync(files.serverCert, { force: true })
    opts.onRenew?.('autorite', opts.renewAuthority ? 'demande' : firstRun ? 'absente' : 'invalide ou proche de l’échéance')
  }

  let server = readPair(files.serverCert, files.serverKey)
  const reason = server ? serverNeedsRenewal(server, ca, names, now) : 'absent'
  if (!server || reason) {
    server = createServerCertificate(ca, names, now)
    writeSecret(files.serverKey, server.keyPem, 0o600)
    writeSecret(files.serverCert, server.certPem, 0o644)
    opts.onRenew?.('serveur', reason ?? 'absent')
  }

  const caCert = new X509Certificate(ca.certPem)
  const label = /CN=([^\n]+)/.exec(caCert.subject)?.[1] ?? 'FLŌW-Bridge'
  return {
    cert: Buffer.from(server.certPem),
    key: Buffer.from(server.keyPem),
    ca: { pem: ca.certPem, der: caCert.raw, fingerprint: caCert.fingerprint256, label },
    names,
    validTo: new Date(new X509Certificate(server.certPem).validTo),
  }
}

export function hasAuthority(home: string): boolean {
  return existsSync(certificateFiles(home).caCert)
}

// --- Profil de configuration Apple (iPad, iPhone) -------------------------

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// UUID stable pour une même autorité : réinstaller remplace l'ancien profil
function stableUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase()
}

// Profil non signé contenant le seul certificat racine (charge utile
// com.apple.security.root). iOS l'installe depuis Réglages, puis demande
// d'activer la confiance totale (Général, Informations, Réglages des certificats).
export function mobileconfig(ca: { der: Buffer; fingerprint: string; label: string }): string {
  const id = ca.fingerprint.replace(/:/g, '').slice(0, 16).toLowerCase()
  const b64 = ca.der.toString('base64').replace(/(.{52})/g, '$1\n\t\t\t')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>PayloadCertificateFileName</key>
			<string>flow-bridge.cer</string>
			<key>PayloadContent</key>
			<data>
			${b64}
			</data>
			<key>PayloadDescription</key>
			<string>Certificat racine du pont FLŌW de la boutique</string>
			<key>PayloadDisplayName</key>
			<string>${xml(ca.label)}</string>
			<key>PayloadIdentifier</key>
			<string>fr.flow.bridge.${id}.racine</string>
			<key>PayloadType</key>
			<string>com.apple.security.root</string>
			<key>PayloadUUID</key>
			<string>${stableUuid(`${ca.fingerprint}/racine`)}</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>Permet à la caisse FLŌW de joindre en connexion sécurisée le pont installé sur l'ordinateur de la boutique (imprimante, tiroir, terminal de paiement). Valable seulement pour les adresses du réseau local. Empreinte SHA-256 : ${ca.fingerprint}</string>
	<key>PayloadDisplayName</key>
	<string>${xml(ca.label)}</string>
	<key>PayloadIdentifier</key>
	<string>fr.flow.bridge.${id}</string>
	<key>PayloadOrganization</key>
	<string>FLŌW</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>${stableUuid(ca.fingerprint)}</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`
}
