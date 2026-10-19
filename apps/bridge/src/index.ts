#!/usr/bin/env node
// Point d'entrée : « flow-bridge » démarre le pont,
// « flow-bridge pair » affiche un nouveau code d'appairage (le service peut tourner),
// « flow-bridge --pair » démarre le pont en affichant un code même si des caisses sont appairées.
// « flow-bridge cert » et « flow-bridge reseau » : certificat et accès des iPad (cli-tls.ts).
// « flow-bridge installer » / « desinstaller » : démarrage avec la session (install.ts) ;
// l'exécutable autonome s'installe aussi seul au premier double-clic.

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  BACKGROUND_FLAG,
  hasDesktop,
  isInstallPlatform,
  NO_INSTALL_FLAG,
  pairingPageUrl,
  shouldAutoInstall,
} from './autostart.js'
import { certCommand, networkCommand, printStartup, setupTls } from './cli-tls.js'
import { loadConfig, type BridgeConfig } from './config.js'
import { clearRunning, installBridge, openBrowser, uninstallBridge, waitForBridge, writeRunning, type InstallContext } from './install.js'
import { createLogger, redirectConsoleToFile, type Logger } from './log.js'
import { createPendingCode, formatCode, printCode } from './pairing.js'
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
  flow-bridge            démarre le pont (exécutable : s'installe au premier lancement)
  flow-bridge installer  copie le pont dans le dossier de l'utilisateur et le lance à chaque session
  flow-bridge desinstaller   retire le démarrage automatique et la copie installée
  flow-bridge --sans-installation   démarre le pont dans cette fenêtre, sans l'installer
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
  FLOW_APP_URL           adresse de la caisse (sinon celle inscrite dans l'exécutable)
  FLOW_BRIDGE_INSTALL    0 : l'exécutable ne s'installe pas au premier lancement
  FLOW_BRIDGE_NAVIGATEUR 0 : n'ouvre jamais le navigateur
`

function installContext(config: BridgeConfig): InstallContext | null {
  if (!isInstallPlatform(process.platform)) return null
  return {
    platform: process.platform,
    home: homedir(),
    env: process.env,
    execPath: process.execPath,
    configHome: config.home,
    uid: process.getuid?.(),
  }
}

const METHOD_LABEL = {
  'dossier Démarrage': 'dossier Démarrage de Windows, lancement sans fenêtre',
  LaunchAgent: 'agent de session macOS (LaunchAgent)',
  systemd: 'service systemd de l’utilisateur',
  autostart: 'démarrage automatique du bureau (.desktop)',
} as const

// Installe (ou met à jour) puis laisse tourner le pont en arrière-plan.
// Renvoie faux si le pont doit plutôt tourner dans cette fenêtre.
async function install(config: BridgeConfig, log: Logger, explicit: boolean): Promise<boolean> {
  const ctx = installContext(config)
  if (!ctx) {
    log.error('Démarrage automatique non pris en charge sur ce système.')
    return false
  }
  console.log('Installation de FLŌW-Bridge pour cet utilisateur…')
  let report
  try {
    report = await installBridge(ctx)
  } catch (err) {
    log.error('Installation impossible', { erreur: (err as Error).message })
    return false
  }
  console.log(`Pont installé dans ${report.layout.dir}`)
  console.log(`Démarrage automatique : ${METHOD_LABEL[report.method]}.`)
  const store = new ConfigStore(config.home)
  const page = `http://127.0.0.1:${config.port}/`
  if (report.started) {
    if (!(await waitForBridge(config.port, 15_000))) {
      log.warn('Le pont installé ne répond pas encore.')
      return false
    }
    console.log('\nFLŌW-Bridge tourne en arrière-plan et démarrera seul à chaque ouverture de session.')
    if (!store.hasClients() && config.appUrl && hasDesktop(process.platform, process.env)) {
      console.log("La caisse s'ouvre dans votre navigateur pour l'appairage.")
    }
  } else {
    console.log('\nFLŌW-Bridge tourne déjà en arrière-plan.')
    if (!explicit && hasDesktop(process.platform, process.env)) {
      // Relancé d'un double-clic : appairage direct, ou page d'état du pont
      if (!store.hasClients() && config.appUrl) {
        const code = createPendingCode(store)
        printCode(log, code)
        openBrowser(pairingPageUrl(config.appUrl, code, config.port))
      } else {
        openBrowser(page)
      }
    }
  }
  console.log(`Code d'appairage et état du matériel : ${page} (sur cet ordinateur).`)
  console.log(`Pour l'enlever : « ${report.layout.exe} desinstaller ».`)
  if (!explicit) {
    console.log('\nVous pouvez fermer cette fenêtre.')
    if (process.platform === 'win32') await new Promise((r) => setTimeout(r, 8000))
  }
  return true
}

async function uninstall(config: BridgeConfig): Promise<number> {
  const ctx = installContext(config)
  if (!ctx) {
    console.error('Démarrage automatique non pris en charge sur ce système.')
    return 2
  }
  const report = await uninstallBridge(ctx)
  if (report.removed.length === 0) console.log("FLŌW-Bridge n'était pas installé pour cet utilisateur.")
  for (const r of report.removed) console.log(`Supprimé : ${r}`)
  if (report.deferred) console.log('Le dossier du pont sera effacé dans quelques secondes.')
  console.log(`\nLe pont ne démarrera plus avec la session. Les caisses appairées et le certificat restent dans ${config.home} : supprimez ce dossier pour tout effacer.`)
  return 0
}

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
  const background = args.includes(BACKGROUND_FLAG)
  // Lancé par le démarrage de session : journal dans un fichier (systemd garde le sien)
  if (background && !process.stdout.isTTY && !process.env.INVOCATION_ID) {
    redirectConsoleToFile(join(config.home, 'flow-bridge.log'))
  }
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

  if (args[0] === 'installer' || args[0] === 'install') {
    if (!STANDALONE) {
      console.error("« installer » est réservé à l'exécutable autonome. En développement, voir « Faire tourner le pont en service » dans apps/bridge/README.md.")
      process.exitCode = 2
      return
    }
    process.exitCode = (await install(config, log, true)) ? 0 : 1
    return
  }

  if (args[0] === 'desinstaller' || args[0] === 'désinstaller' || args[0] === 'uninstall') {
    process.exitCode = await uninstall(config)
    return
  }

  if (STANDALONE) process.title = NAME

  const known = ['--pair', '--reseau', BACKGROUND_FLAG, NO_INSTALL_FLAG]
  if (args.some((a) => !known.includes(a))) {
    console.error(`Argument inconnu : ${args.join(' ')}\n`)
    console.log(HELP)
    process.exitCode = 2
    return
  }

  // Premier double-clic : copie, démarrage avec la session, puis le pont
  // installé prend le relais en arrière-plan
  const interactive = process.stdout.isTTY === true || (process.platform === 'linux' && hasDesktop(process.platform, process.env))
  if (shouldAutoInstall({ standalone: STANDALONE, args, env: process.env, platform: process.platform, interactive })) {
    if (await install(config, log, false)) return
    console.log('Le pont démarre dans cette fenêtre.\n')
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
    if (e.code === 'EADDRINUSE' && background) {
      // Démarrage de session alors qu'un pont tourne déjà : rien à faire
      log.info(`Le port ${config.port} est déjà utilisé : un pont tourne déjà.`)
      return
    }
    if (e.code === 'EADDRINUSE') {
      log.error(`Le port ${config.port} est déjà utilisé : le pont tourne peut-être déjà. Pour appairer une caisse, lancez « flow-bridge pair ».`)
    } else {
      log.error('Démarrage impossible', { erreur: e.message })
    }
    return exitWithError()
  }
  printStartup(server, log)
  writeRunning(config.home, { pid: process.pid, port: server.port, exe: process.execPath, startedAt: new Date().toISOString() })
  if (STANDALONE && !background) console.log("Laissez cette fenêtre ouverte pendant la journée. Pour arrêter le pont, fermez-la ou appuyez sur Ctrl+C.\n")
  log.info(`Code d'appairage et état : http://127.0.0.1:${server.port}/ sur cet ordinateur`)

  // Aucune caisse appairée : la caisse s'ouvre dans le navigateur avec le
  // code dans le fragment de l'adresse (jamais envoyé au serveur web)
  const code = server.pairing.currentCode
  if (code && !store.hasClients() && config.appUrl && hasDesktop(process.platform, process.env)) {
    const url = pairingPageUrl(config.appUrl, code, server.port)
    if (openBrowser(url)) log.info("Ouverture de la caisse dans le navigateur pour l'appairage", { code: formatCode(code) })
  }

  let stopping = false
  const stop = async (signal: string) => {
    if (stopping) return
    stopping = true
    log.info('Arrêt du pont', { signal })
    const force = setTimeout(() => process.exit(1), 10_000)
    force.unref()
    await server.close()
    clearRunning(config.home)
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
