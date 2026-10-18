// Commandes « flow-bridge cert » et « flow-bridge reseau », et messages de
// démarrage sur la connexion sécurisée et l'accès des iPad.

import { execFileSync } from 'node:child_process'
import { X509Certificate } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { certificateFiles, ensureCertificates, lanIPv4, type TlsMaterial } from './cert.js'
import type { BridgeConfig } from './config.js'
import type { Logger } from './log.js'
import type { BridgeServer } from './server.js'
import { ConfigStore } from './store.js'

// Prépare config.tls ; renvoie de quoi renouveler le certificat en marche
export function setupTls(config: BridgeConfig, log: Logger): (() => TlsMaterial) | undefined {
  if (config.tls || !config.autoTls) return undefined
  const onRenew = (what: 'autorite' | 'serveur', reason: string) => {
    if (what === 'autorite' && reason === 'absente') log.info('Autorité de certification du pont créée : à approuver une fois sur les Mac et iPad')
    else if (what === 'autorite') log.warn('Nouvelle autorité de certification : approuvez-la à nouveau sur les Mac et iPad', { raison: reason })
    else log.info('Certificat du serveur créé', { raison: reason })
  }
  const load = () => ensureCertificates(config.home, { onRenew })
  try {
    config.tls = load()
    return load
  } catch (err) {
    // Le pont reste utilisable en ws:// local (Chrome, Edge, Firefox)
    log.error('Certificat du pont indisponible : connexion sécurisée désactivée', { erreur: (err as Error).message })
    return undefined
  }
}

export function printStartup(server: BridgeServer, log: Logger) {
  const lines: string[] = []
  const port = server.port
  const ca = server.certificate?.ca
  if (server.secure) {
    lines.push(`Connexion sécurisée : wss://127.0.0.1:${port}`)
    if (ca) {
      lines.push(`Certificat : ${ca.label}`)
      lines.push(`Empreinte SHA-256 : ${ca.fingerprint}`)
      lines.push(`Safari sur cet ordinateur : ouvrez http://127.0.0.1:${port}/ pour installer le certificat.`)
    }
  } else {
    lines.push(`Connexion locale non chiffrée : ws://127.0.0.1:${port} (Chrome, Edge, Firefox)`)
  }
  if (server.lanEnabled) {
    const addresses = server.lanAddresses()
    if (addresses.length === 0) lines.push('Accès réseau ouvert, mais aucune adresse locale détectée.')
    for (const a of addresses) {
      lines.push(`iPad : adresse du pont ${a}`)
      if (ca) lines.push(`  certificat à installer sur l'iPad : http://${a}:${port}/certificat`)
    }
  } else {
    lines.push("Accès réseau (iPad) fermé. Pour l'ouvrir : « flow-bridge reseau oui » ou depuis les réglages de la caisse.")
  }
  log.banner(lines)
}

function describe(material: TlsMaterial, home: string) {
  const files = certificateFiles(home)
  const ca = material.ca!
  console.log(`Autorité : ${ca.label}`)
  console.log(`Empreinte SHA-256 : ${ca.fingerprint}`)
  const server = new X509Certificate(material.cert)
  console.log(`Certificat du serveur : valable jusqu'au ${new Date(server.validTo).toLocaleDateString('fr-FR')}`)
  console.log(`Noms couverts : ${server.subjectAltName ?? ''}`)
  console.log('\nFichiers :')
  console.log(`  autorité (à installer sur les appareils) : ${files.caCert}`)
  console.log(`  clé de l'autorité (secrète, ne quitte jamais cet ordinateur) : ${files.caKey}`)
  console.log(`  certificat du serveur : ${files.serverCert}`)
  console.log(`  clé du serveur : ${files.serverKey}`)
}

export async function certCommand(config: BridgeConfig, args: string[]): Promise<number> {
  if (config.tls) {
    const c = new X509Certificate(config.tls.cert)
    console.log('Certificat fourni par FLOW_BRIDGE_CERT : le pont ne fabrique pas le sien.')
    console.log(`Sujet : ${c.subject.replace(/\n/g, ', ')}`)
    console.log(`Émetteur : ${c.issuer.replace(/\n/g, ', ')}`)
    console.log(`Empreinte SHA-256 : ${c.fingerprint256}`)
    return 0
  }
  const unknown = args.filter((a) => a !== '--renouveler' && a !== '--approuver')
  if (unknown.length) {
    console.error(`Argument inconnu : ${unknown.join(' ')}`)
    return 2
  }
  const renew = args.includes('--renouveler')
  const material = ensureCertificates(config.home, { renewAuthority: renew })
  if (renew) {
    console.log("Nouvelle autorité créée. L'ancienne n'est plus valable : approuvez la nouvelle sur chaque Mac et iPad.")
    console.log('Redémarrez le pont s’il tourne déjà (il reprendra aussi le nouveau certificat dans les 5 minutes).\n')
  }
  describe(material, config.home)
  if (args.includes('--approuver')) return trustOnMac(config.home)
  return 0
}

// Mac : ajoute l'autorité au trousseau de session, approuvée pour TLS.
// macOS demande le mot de passe de la session dans une fenêtre.
function trustOnMac(home: string): number {
  if (process.platform !== 'darwin') {
    console.error('\n« --approuver » ne fonctionne que sur Mac. Ailleurs, suivez la procédure affichée dans les réglages de la caisse.')
    return 2
  }
  const keychain = join(homedir(), 'Library/Keychains/login.keychain-db')
  console.log('\nmacOS va demander le mot de passe de votre session pour approuver le certificat.')
  try {
    execFileSync('security', ['add-trusted-cert', '-r', 'trustRoot', '-p', 'ssl', '-k', keychain, certificateFiles(home).caCert], { stdio: 'inherit' })
    console.log('Certificat approuvé. Rechargez la caisse dans Safari.')
    return 0
  } catch {
    console.error("Le certificat n'a pas été approuvé (annulé ou refusé).")
    return 1
  }
}

export function networkCommand(config: BridgeConfig, args: string[]): number {
  const store = new ConfigStore(config.home)
  const choice = args[0]?.toLowerCase()
  if (choice === 'oui' || choice === 'non') {
    store.setLan(choice === 'oui')
    console.log(
      choice === 'oui'
        ? "Accès réseau ouvert aux iPad du magasin. Redémarrez le pont pour l'appliquer."
        : "Accès réseau fermé : seul cet ordinateur pourra joindre le pont. Redémarrez le pont pour l'appliquer.",
    )
    if (config.lan !== undefined) console.log(`Attention : FLOW_BRIDGE_LAN=${config.lan ? '1' : '0'} est défini et l'emporte sur ce réglage.`)
    return 0
  }
  if (choice) {
    console.error(`Argument inconnu : ${choice} (oui ou non attendu)`)
    return 2
  }
  const enabled = config.lan ?? store.getLan()
  console.log(`Accès réseau (iPad) : ${enabled ? 'ouvert' : 'fermé'}${config.lan !== undefined ? ' (FLOW_BRIDGE_LAN)' : ''}`)
  const addresses = lanIPv4()
  if (addresses.length === 0) console.log("Aucune adresse sur un réseau local n'a été détectée.")
  for (const a of addresses) {
    console.log(`Adresse du pont à saisir sur l'iPad : ${a}`)
    console.log(`  certificat à installer : http://${a}:${config.port}/certificat`)
  }
  if (!enabled) console.log("\nPour l'ouvrir : flow-bridge reseau oui")
  return 0
}
