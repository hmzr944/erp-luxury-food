#!/usr/bin/env node
// Point d'entrée : « flow-bridge » démarre le pont,
// « flow-bridge pair » affiche un nouveau code d'appairage (le service peut tourner),
// « flow-bridge --pair » démarre le pont en affichant un code même si des caisses sont appairées.

import { loadConfig } from './config.js'
import { createLogger } from './log.js'
import { createPendingCode, printCode } from './pairing.js'
import { BridgeServer } from './server.js'
import { ConfigStore } from './store.js'
import { NAME, VERSION } from './version.js'

const HELP = `${NAME} ${VERSION}

Utilisation :
  flow-bridge            démarre le pont
  flow-bridge --pair     démarre le pont et affiche un code d'appairage
  flow-bridge pair       affiche un code d'appairage pour le pont déjà lancé
  flow-bridge clients    liste les caisses appairées

Variables d'environnement :
  FLOW_BRIDGE_PORT       port local (51717)
  FLOW_BRIDGE_ORIGINS    origines autorisées, séparées par des virgules (http://localhost:3000)
  FLOW_BRIDGE_HOME       dossier de configuration (~/.flow-bridge)
  FLOW_BRIDGE_CERT       certificat TLS (PEM) pour wss://
  FLOW_BRIDGE_KEY        clé privée TLS (PEM)
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

  if (args.length > 0 && !args.includes('--pair')) {
    console.error(`Argument inconnu : ${args.join(' ')}\n`)
    console.log(HELP)
    process.exitCode = 2
    return
  }

  const server = new BridgeServer(config, { logger: createLogger(config.logLevel), forcePairingCode: args.includes('--pair') })
  try {
    await server.listen()
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EADDRINUSE') {
      log.error(`Le port ${config.port} est déjà utilisé : le pont tourne peut-être déjà. Pour appairer une caisse, lancez « flow-bridge pair ».`)
    } else {
      log.error('Démarrage impossible', { erreur: e.message })
    }
    process.exit(1)
  }

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

void main()
