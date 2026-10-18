#!/usr/bin/env node
// Point d'entrée : « flow-bridge » démarre le pont,
// « flow-bridge pair » affiche un nouveau code d'appairage (le service peut tourner),
// « flow-bridge --pair » démarre le pont en affichant un code même si des caisses sont appairées.
// « flow-bridge cert » et « flow-bridge reseau » : certificat et accès des iPad (cli-tls.ts).

import { certCommand, networkCommand, printStartup, setupTls } from './cli-tls.js'
import { loadConfig } from './config.js'
import { createLogger } from './log.js'
import { createPendingCode, printCode } from './pairing.js'
import { BridgeServer } from './server.js'
import { ConfigStore } from './store.js'
import { NAME, VERSION } from './version.js'

// Exécutable autonome (scripts/build-binaries.mjs) : lancé d'un double-clic,
// il affiche toujours un code d'appairage et garde la fenêtre ouverte en cas d'erreur
const STANDALONE = process.env.FLOW_BRIDGE_BUILD_STANDALONE === '1'

// Double-clic sous Windows : la console se ferme dès la sortie du programme,
// on laisse le temps de lire le message
async function exitWithError(): Promise<never> {
  if (STANDALONE && process.platform === 'win32' && process.stdin.isTTY) {
    console.error('\nAppuyez sur Entrée pour fermer cette fenêtre.')
    await new Promise((resolve) => {
      process.stdin.resume()
      process.stdin.once('data', resolve)
    })
  }
  process.exit(1)
}

const HELP = `${NAME} ${VERSION}

Utilisation :
  flow-bridge            démarre le pont
  flow-bridge --pair     démarre le pont et affiche un code d'appairage
  flow-bridge pair       affiche un code d'appairage pour le pont déjà lancé
  flow-bridge clients    liste les caisses appairées
  flow-bridge --reseau   démarre le pont ouvert aux iPad du réseau local
  flow-bridge reseau     affiche l'accès réseau ; « reseau oui » ou « reseau non » le règle
  flow-bridge cert       affiche le certificat du pont (empreinte, fichiers)
  flow-bridge cert --renouveler   recrée l'autorité et le certificat (à approuver à nouveau)
  flow-bridge cert --approuver    Mac : approuve le certificat dans le trousseau de session

Variables d'environnement :
  FLOW_BRIDGE_PORT       port local (51717)
  FLOW_BRIDGE_ORIGINS    origines autorisées, séparées par des virgules (http://localhost:3000)
  FLOW_BRIDGE_HOME       dossier de configuration (~/.flow-bridge)
  FLOW_BRIDGE_CERT       certificat TLS (PEM) pour wss:// (sinon fabriqué par le pont)
  FLOW_BRIDGE_KEY        clé privée TLS (PEM)
  FLOW_BRIDGE_TLS        0 : pas de wss://, ws:// local seulement
  FLOW_BRIDGE_LAN        1 : ouvert aux iPad du réseau local ; 0 : cet ordinateur seulement
  FLOW_BRIDGE_LOG        debug | info | warn | error | silent
`

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION)
    return
  }

  const config = loadConfig()
  const log = createLogger(config.logLevel === 'silent' ? 'info' : config.logLevel)

  if (args[0] === 'pair') {
    const code = createPendingCode(new ConfigStore(config.home))
    printCode(log, code)
    return
  }

  if (args[0] === 'clients') {
    const clients = new ConfigStore(config.home).listClients()
    if (clients.length === 0) console.log('Aucune caisse appairée.')
    for (const c of clients) console.log(`${c.name}  (appairée le ${c.createdAt}${c.lastSeenAt ? `, vue le ${c.lastSeenAt}` : ''})`)
    return
  }

  if (args[0] === 'cert') {
    process.exitCode = await certCommand(config, args.slice(1))
    return
  }

  if (args[0] === 'reseau' || args[0] === 'réseau') {
    process.exitCode = networkCommand(config, args.slice(1))
    return
  }

  if (STANDALONE) process.title = NAME

  if (args.some((a) => a !== '--pair' && a !== '--reseau')) {
    console.error(`Argument inconnu : ${args.join(' ')}\n`)
    console.log(HELP)
    process.exitCode = 2
    return
  }

  // Exécutable lancé sans argument (double-clic) : comme « --pair »
  const forcePairingCode = args.includes('--pair') || (STANDALONE && args.length === 0)
  const store = new ConfigStore(config.home)
  // Accès réseau : --reseau, sinon FLOW_BRIDGE_LAN, sinon le réglage enregistré
  if (args.includes('--reseau')) config.lan = true
  else config.lan ??= store.getLan()
  const refreshTls = setupTls(config, log)
  const server = new BridgeServer(config, {
    logger: createLogger(config.logLevel),
    forcePairingCode,
    refreshTls,
    persistLan: (enabled) => store.setLan(enabled),
  })
  try {
    await server.listen()
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EADDRINUSE') {
      log.error(`Le port ${config.port} est déjà utilisé : le pont tourne peut-être déjà. Pour appairer une caisse, lancez « flow-bridge pair ».`)
    } else {
      log.error('Démarrage impossible', { erreur: e.message })
    }
    return exitWithError()
  }
  printStartup(server, log)
  if (STANDALONE) console.log("Laissez cette fenêtre ouverte pendant la journée. Pour arrêter le pont, fermez-la ou appuyez sur Ctrl+C.\n")

  let stopping = false
  const stop = async (signal: string) => {
    if (stopping) return
    stopping = true
    log.info('Arrêt du pont', { signal })
    const force = setTimeout(() => process.exit(1), 10_000)
    force.unref()
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void stop('SIGINT'))
  process.on('SIGTERM', () => void stop('SIGTERM'))
  // Une erreur imprévue est journalisée sans faire tomber la caisse
  process.on('uncaughtException', (err) => log.error('Exception non gérée', { erreur: err.message }))
  process.on('unhandledRejection', (err) => log.error('Promesse rejetée non gérée', { erreur: String(err) }))
}

main().catch((err: unknown) => {
  console.error(`${NAME} : ${err instanceof Error ? err.message : String(err)}`)
  return exitWithError()
})
