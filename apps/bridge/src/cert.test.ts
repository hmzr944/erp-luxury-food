import { execFileSync } from 'node:child_process'
import { X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  caLabel,
  certificateFiles,
  createAuthority,
  createServerCertificate,
  currentLocalNames,
  ensureCertificates,
  isPermittedIPv4,
  mdnsName,
  mobileconfig,
  SERVER_DAYS,
} from './cert.js'
import { integer, oid, time, tlv } from './der.js'

const NAMES = { dns: ['localhost', 'caisse-boutique.local'], ips: ['127.0.0.1', '::1', '192.168.1.20'] }
const DAY = 24 * 3600 * 1000

function hasOpenssl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('encodage DER', () => {
  it('encode entiers, OID, longueurs longues et dates', () => {
    expect(integer(0).toString('hex')).toBe('020100')
    expect(integer(128).toString('hex')).toBe('02020080')
    expect(integer(Buffer.from([0, 0, 0x7f])).toString('hex')).toBe('02017f')
    expect(oid('1.2.840.10045.4.3.2').toString('hex')).toBe('06082a8648ce3d040302')
    expect(tlv(0x04, Buffer.alloc(200)).subarray(0, 3).toString('hex')).toBe('0481c8')
    expect(tlv(0x04, Buffer.alloc(300)).subarray(0, 4).toString('hex')).toBe('0482012c')
    expect(time(new Date('2030-01-02T03:04:05Z')).toString('latin1').slice(2)).toBe('300102030405Z')
    expect(time(new Date('2050-01-02T03:04:05Z'))[0]).toBe(0x18)
  })
})

describe('noms couverts', () => {
  it('nom Bonjour et adresses permises seulement', () => {
    expect(mdnsName('MacBook-Pro-de-Marie.local')).toBe('macbook-pro-de-marie.local')
    expect(mdnsName('PC_CAISSE')).toBe('pc-caisse.local')
    expect(isPermittedIPv4('192.168.1.20')).toBe(true)
    expect(isPermittedIPv4('172.31.255.1')).toBe(true)
    expect(isPermittedIPv4('172.32.0.1')).toBe(false)
    expect(isPermittedIPv4('192.0.2.2')).toBe(false)
    expect(isPermittedIPv4('8.8.8.8')).toBe(false)
    const n = currentLocalNames('Caisse', ['10.0.0.5', '203.0.113.9'])
    expect(n).toEqual({ dns: ['localhost', 'caisse.local'], ips: ['127.0.0.1', '::1', '10.0.0.5'] })
    expect(caLabel('Caisse.local')).toBe('FLŌW-Bridge (Caisse)')
  })
})

describe('autorité et certificat serveur', () => {
  const ca = createAuthority('FLŌW-Bridge (Essai)')
  const server = createServerCertificate(ca, NAMES)
  const caCert = new X509Certificate(ca.certPem)
  const leaf = new X509Certificate(server.certPem)

  it('autorité racine auto-signée', () => {
    expect(caCert.ca).toBe(true)
    expect(caCert.checkIssued(caCert)).toBe(true)
    expect(caCert.verify(caCert.publicKey)).toBe(true)
    expect(caCert.subject).toContain('CN=FLŌW-Bridge (Essai)')
    expect(caCert.publicKey.asymmetricKeyDetails?.namedCurve).toBe('prime256v1')
  })

  it('certificat serveur signé par l’autorité, noms et usages attendus', () => {
    expect(leaf.ca).toBe(false)
    expect(leaf.checkIssued(caCert)).toBe(true)
    expect(leaf.verify(caCert.publicKey)).toBe(true)
    expect(leaf.checkHost('localhost')).toBe('localhost')
    expect(leaf.checkHost('caisse-boutique.local')).toBe('caisse-boutique.local')
    expect(leaf.checkHost('example.com')).toBeUndefined()
    expect(leaf.checkIP('127.0.0.1')).toBe('127.0.0.1')
    expect(leaf.checkIP('192.168.1.20')).toBe('192.168.1.20')
    expect(leaf.checkIP('::1')).toBe('::1')
    expect(leaf.checkIP('192.168.1.21')).toBeUndefined()
    expect(leaf.keyUsage).toEqual(['1.3.6.1.5.5.7.3.1'])
    const days = (new Date(leaf.validTo).getTime() - new Date(leaf.validFrom).getTime()) / DAY
    expect(days).toBeLessThanOrEqual(825)
    expect(Math.round(days)).toBe(SERVER_DAYS)
  })

  it.runIf(hasOpenssl())('openssl valide la chaîne et applique les contraintes de noms', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cert-'))
    try {
      const caFile = join(dir, 'ca.pem')
      writeFileSync(caFile, ca.certPem)
      writeFileSync(join(dir, 'leaf.pem'), server.certPem)
      const text = execFileSync('openssl', ['x509', '-in', caFile, '-text', '-noout'], { encoding: 'utf8' })
      expect(text).toContain('X509v3 Name Constraints: critical')
      expect(text).toContain('DNS:local')
      expect(text).toContain('IP:192.168.0.0/255.255.0.0')
      const ok = (args: string[]) => execFileSync('openssl', ['verify', '-CAfile', caFile, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      expect(ok(['-purpose', 'sslserver', join(dir, 'leaf.pem')])).toContain('OK')
      expect(ok(['-verify_hostname', 'caisse-boutique.local', join(dir, 'leaf.pem')])).toContain('OK')
      expect(ok(['-verify_ip', '192.168.1.20', join(dir, 'leaf.pem')])).toContain('OK')

      // Une clé volée ne sert à rien pour un site public : refusé par les contraintes
      const forged = createServerCertificate(ca, { dns: ['banque.example.com'], ips: ['8.8.8.8'] })
      writeFileSync(join(dir, 'forged.pem'), forged.certPem)
      let err = ''
      try {
        ok([join(dir, 'forged.pem')])
      } catch (e) {
        err = String((e as { stdout?: string }).stdout) + String((e as { stderr?: string }).stderr)
      }
      expect(err).toMatch(/permitted subtree violation/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('profil iOS : charge utile racine avec le certificat DER', () => {
    const p = mobileconfig({ der: caCert.raw, fingerprint: caCert.fingerprint256, label: 'FLŌW-Bridge (Essai)' })
    expect(p).toContain('<string>com.apple.security.root</string>')
    expect(p).toContain('<string>Configuration</string>')
    const b64 = /<data>([\s\S]*?)<\/data>/.exec(p)![1].replace(/\s+/g, '')
    expect(Buffer.from(b64, 'base64').equals(caCert.raw)).toBe(true)
    expect(p).toContain(caCert.fingerprint256)
    // Même autorité, même identifiant : réinstaller remplace le profil
    expect(mobileconfig({ der: caCert.raw, fingerprint: caCert.fingerprint256, label: 'x' }).match(/<key>PayloadUUID<\/key>\s*<string>([^<]+)/g)).toEqual(
      p.match(/<key>PayloadUUID<\/key>\s*<string>([^<]+)/g),
    )
  })
})

describe('ensureCertificates', () => {
  let home: string
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'flow-bridge-tls-'))
  })
  afterEach(() => rmSync(home, { recursive: true, force: true }))

  it('crée les fichiers, clés en 0600, puis les réutilise', () => {
    const renewals: string[] = []
    const onRenew = (w: string) => renewals.push(w)
    const a = ensureCertificates(home, { names: NAMES, host: 'Caisse', onRenew })
    expect(renewals).toEqual(['autorite', 'serveur'])
    const files = certificateFiles(home)
    if (process.platform !== 'win32') {
      expect(statSync(files.caKey).mode & 0o777).toBe(0o600)
      expect(statSync(files.serverKey).mode & 0o777).toBe(0o600)
      expect(statSync(files.dir).mode & 0o777).toBe(0o700)
    }
    expect(a.ca!.label).toBe('FLŌW-Bridge (Caisse)')
    const b = ensureCertificates(home, { names: NAMES, onRenew })
    expect(renewals).toEqual(['autorite', 'serveur'])
    expect(b.cert.equals(a.cert)).toBe(true)
    expect(b.ca!.fingerprint).toBe(a.ca!.fingerprint)
  })

  it('renouvelle le seul certificat serveur pour une nouvelle adresse ou une échéance proche', () => {
    const a = ensureCertificates(home, { names: NAMES })
    const moved = ensureCertificates(home, { names: { ...NAMES, ips: [...NAMES.ips, '10.1.2.3'] } })
    expect(moved.cert.equals(a.cert)).toBe(false)
    expect(moved.ca!.fingerprint).toBe(a.ca!.fingerprint)
    expect(new X509Certificate(moved.cert).checkIP('10.1.2.3')).toBe('10.1.2.3')

    const later = ensureCertificates(home, { names: moved.names, now: new Date(Date.now() + (SERVER_DAYS - 10) * DAY) })
    expect(later.cert.equals(moved.cert)).toBe(false)
    expect(later.ca!.fingerprint).toBe(a.ca!.fingerprint)
  })

  it('« --renouveler » recrée aussi l’autorité ; un fichier abîmé est refait', () => {
    const a = ensureCertificates(home, { names: NAMES })
    const b = ensureCertificates(home, { names: NAMES, renewAuthority: true })
    expect(b.ca!.fingerprint).not.toBe(a.ca!.fingerprint)
    expect(new X509Certificate(b.cert).checkIssued(new X509Certificate(b.ca!.pem))).toBe(true)

    writeFileSync(certificateFiles(home).serverCert, 'abîmé')
    const c = ensureCertificates(home, { names: NAMES })
    expect(c.ca!.fingerprint).toBe(b.ca!.fingerprint)
    expect(readFileSync(certificateFiles(home).serverCert, 'utf8')).toContain('BEGIN CERTIFICATE')
  })
})
