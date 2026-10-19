// Installation par utilisateur et démarrage avec la session (« flow-bridge
// installer », ou premier double-clic sur l'exécutable). Les chemins et le
// contenu des fichiers viennent d'autostart.ts ; ici, les effets : copie,
// écriture, launchctl, systemctl, wscript. Les commandes système passent par
// InstallDeps, remplacé en test : rien n'est réellement inscrit.

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  BACKGROUND_FLAG,
  browserCommand,
  desktopEntry,
  encodeVbs,
  installLayout,
  LAUNCH_AGENT_LABEL,
  launchAgentPlist,
  SYSTEMD_UNIT,
  systemdUnit,
  windowsStartupScript,
  type InstallLayout,
  type InstallPlatform,
} from './autostart.js'

export interface InstallContext {
  platform: InstallPlatform
  // Dossier personnel de l'utilisateur
  home: string
  env: NodeJS.ProcessEnv
  // Exécutable en cours (celui qui a été téléchargé)
  execPath: string
  // Dossier de configuration du pont (~/.flow-bridge) : fichier du processus en marche
  configHome: string
  uid?: number
}

export interface InstallDeps {
  // Commande système attendue ; vrai si elle réussit
  run(cmd: string, args: string[]): boolean
  // Processus détaché, sans fenêtre, qui survit à celui-ci
  launch(cmd: string, args: string[], opts?: { verbatim?: boolean }): void
  isAlive(pid: number): boolean
  // Le pont répond-il sur ce port (boucle locale) ?
  responds(port: number): Promise<boolean>
  kill(pid: number): void
  sleep(ms: number): Promise<void>
}

export const systemDeps: InstallDeps = {
  run: (cmd, args) => {
    try {
      return spawnSync(cmd, args, { stdio: 'ignore', windowsHide: true, timeout: 15_000 }).status === 0
    } catch {
      return false
    }
  },
  launch: (cmd, args, opts = {}) => {
    const child = spawn(cmd, args, { cwd: homedir(), detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: opts.verbatim })
    child.on('error', () => {})
    child.unref()
  },
  isAlive: (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'EPERM'
    }
  },
  responds: (port) => bridgeResponds(port),
  kill: (pid) => {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // déjà arrêté
    }
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

// --- Processus en marche ------------------------------------------------

export interface RunningInfo {
  pid: number
  port: number
  exe: string
  startedAt: string
}

export function pidFile(configHome: string): string {
  return join(configHome, 'bridge.pid')
}

export function writeRunning(configHome: string, info: RunningInfo) {
  try {
    writeFileSync(pidFile(configHome), JSON.stringify(info) + '\n', { mode: 0o600 })
  } catch {
    // Sans ce fichier, l'installation ne saura pas arrêter ce pont : sans gravité
  }
}

export function readRunning(configHome: string): RunningInfo | null {
  try {
    const r = JSON.parse(readFileSync(pidFile(configHome), 'utf8')) as RunningInfo
    return Number.isInteger(r.pid) && r.pid > 0 ? r : null
  } catch {
    return null
  }
}

export function clearRunning(configHome: string, pid = process.pid) {
  if (readRunning(configHome)?.pid === pid) rmSync(pidFile(configHome), { force: true })
}

// Pont en marche : processus vivant ET qui répond sur son port. Un fichier
// périmé dont le numéro a été repris par un autre programme est ignoré :
// on n'arrête jamais un processus qui n'est pas le pont.
async function runningPid(ctx: InstallContext, deps: InstallDeps): Promise<number | null> {
  const r = readRunning(ctx.configHome)
  if (!r || r.pid === process.pid || !deps.isAlive(r.pid)) return null
  return (await deps.responds(r.port)) ? r.pid : null
}

// --- Fichiers -----------------------------------------------------------

function digest(path: string): string | null {
  let fd: number
  try {
    fd = openSync(path, 'r')
  } catch {
    return null
  }
  try {
    const hash = createHash('sha256')
    const buf = Buffer.alloc(1024 * 1024)
    let n: number
    while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n))
    return hash.digest('hex')
  } finally {
    closeSync(fd)
  }
}

function sameFile(a: string, b: string): boolean {
  try {
    if (statSync(a).size !== statSync(b).size) return false
  } catch {
    return false
  }
  return digest(a) === digest(b)
}

// Écrit seulement si le contenu change ; vrai si le fichier a été écrit
function writeIfChanged(path: string, content: string | Buffer): boolean {
  const data = typeof content === 'string' ? Buffer.from(content) : content
  try {
    if (readFileSync(path).equals(data)) return false
  } catch {
    // absent
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
  return true
}

function removeFile(path: string | undefined, removed: string[]) {
  if (path && existsSync(path)) {
    rmSync(path, { force: true })
    removed.push(path)
  }
}

// L'ancien exécutable peut rester verrouillé un instant après l'arrêt (Windows)
async function copyExecutable(from: string, to: string, deps: InstallDeps) {
  const tmp = `${to}.nouveau`
  let lastError: unknown
  for (let i = 0; i < 10; i++) {
    try {
      copyFileSync(from, tmp)
      chmodSync(tmp, 0o755)
      renameSync(tmp, to)
      return
    } catch (err) {
      lastError = err
      rmSync(tmp, { force: true })
      await deps.sleep(500)
    }
  }
  throw new Error(`Copie impossible vers ${to} : ${(lastError as Error).message}`)
}

// --- Arrêt du pont en marche --------------------------------------------

function unloadService(ctx: InstallContext, deps: InstallDeps, layout: InstallLayout) {
  if (ctx.platform === 'darwin' && layout.launchAgent) {
    deps.run('launchctl', ['bootout', `gui/${ctx.uid ?? 0}/${LAUNCH_AGENT_LABEL}`])
  } else if (ctx.platform === 'linux') {
    deps.run('systemctl', ['--user', 'stop', SYSTEMD_UNIT])
  }
}

async function stopRunning(ctx: InstallContext, deps: InstallDeps, layout: InstallLayout) {
  unloadService(ctx, deps, layout)
  const pid = await runningPid(ctx, deps)
  if (pid === null) return
  deps.kill(pid)
  for (let i = 0; i < 20 && deps.isAlive(pid); i++) await deps.sleep(250)
}

// --- Installation -------------------------------------------------------

export type StartupMethod = 'dossier Démarrage' | 'LaunchAgent' | 'systemd' | 'autostart'

export interface InstallReport {
  layout: InstallLayout
  method: StartupMethod
  // Exécutable copié (première installation ou nouvelle version)
  copied: boolean
  // Pont démarré (ou redémarré) en arrière-plan par cette installation
  started: boolean
  // Un pont tournait déjà et a été laissé tel quel
  alreadyRunning: boolean
}

export async function installBridge(ctx: InstallContext, deps: InstallDeps = systemDeps): Promise<InstallReport> {
  const layout = installLayout(ctx.platform, ctx.home, ctx.env)
  mkdirSync(layout.dir, { recursive: true })

  let copied = false
  if (resolve(ctx.execPath) !== resolve(layout.exe) && !sameFile(ctx.execPath, layout.exe)) {
    // Nouvelle version : l'ancienne est arrêtée avant d'être remplacée
    if (existsSync(layout.exe)) await stopRunning(ctx, deps, layout)
    await copyExecutable(ctx.execPath, layout.exe, deps)
    copied = true
  }

  const running = (await runningPid(ctx, deps)) !== null
  let method: StartupMethod
  let started = false

  if (ctx.platform === 'win32') {
    method = 'dossier Démarrage'
    const changed = writeIfChanged(layout.startupScript!, encodeVbs(windowsStartupScript(layout.exe)))
    if (copied || changed || !running) {
      deps.launch('wscript.exe', [layout.startupScript!])
      started = true
    }
  } else if (ctx.platform === 'darwin') {
    method = 'LaunchAgent'
    const changed = writeIfChanged(layout.launchAgent!, launchAgentPlist(layout.exe))
    if (copied || changed || !running) {
      const domain = `gui/${ctx.uid ?? 0}`
      // bootout puis bootstrap : recharge le fichier, démarre aussitôt (RunAtLoad)
      deps.run('launchctl', ['bootout', `${domain}/${LAUNCH_AGENT_LABEL}`])
      if (!deps.run('launchctl', ['bootstrap', domain, layout.launchAgent!])) deps.run('launchctl', ['load', '-w', layout.launchAgent!])
      started = true
    }
  } else if (deps.run('systemctl', ['--user', 'show-environment'])) {
    method = 'systemd'
    const changed = writeIfChanged(layout.systemdUnit!, systemdUnit(layout.exe))
    // Un seul mode de démarrage : l'ancienne entrée .desktop lancerait un second pont
    removeFile(layout.desktopEntry, [])
    if (changed) deps.run('systemctl', ['--user', 'daemon-reload'])
    deps.run('systemctl', ['--user', 'enable', SYSTEMD_UNIT])
    if (copied || changed || !running) {
      // Un pont lancé hors systemd (double-clic précédent) laisse la place
      const pid = await runningPid(ctx, deps)
      if (pid !== null) {
        deps.kill(pid)
        for (let i = 0; i < 20 && deps.isAlive(pid); i++) await deps.sleep(250)
      }
      deps.run('systemctl', ['--user', 'restart', SYSTEMD_UNIT])
      started = true
    }
  } else {
    method = 'autostart'
    writeIfChanged(layout.desktopEntry!, desktopEntry(layout.exe))
    if (copied || !running) {
      deps.launch(layout.exe, [BACKGROUND_FLAG])
      started = true
    }
  }

  return { layout, method, copied, started, alreadyRunning: running && !started }
}

// --- Désinstallation ----------------------------------------------------

export interface UninstallReport {
  layout: InstallLayout
  removed: string[]
  // Windows : l'exécutable en cours ne peut pas s'effacer lui-même ; le
  // dossier est supprimé quelques secondes après la fin du programme
  deferred: boolean
}

export async function uninstallBridge(ctx: InstallContext, deps: InstallDeps = systemDeps): Promise<UninstallReport> {
  const layout = installLayout(ctx.platform, ctx.home, ctx.env)
  const removed: string[] = []

  if (ctx.platform === 'darwin') {
    deps.run('launchctl', ['bootout', `gui/${ctx.uid ?? 0}/${LAUNCH_AGENT_LABEL}`])
    removeFile(layout.launchAgent, removed)
  } else if (ctx.platform === 'linux') {
    deps.run('systemctl', ['--user', 'disable', '--now', SYSTEMD_UNIT])
    const hadUnit = existsSync(layout.systemdUnit!)
    removeFile(layout.systemdUnit, removed)
    if (hadUnit) deps.run('systemctl', ['--user', 'daemon-reload'])
    removeFile(layout.desktopEntry, removed)
  } else {
    removeFile(layout.startupScript, removed)
  }

  const pid = await runningPid(ctx, deps)
  if (pid !== null) {
    deps.kill(pid)
    for (let i = 0; i < 20 && deps.isAlive(pid); i++) await deps.sleep(250)
  }

  let deferred = false
  if (existsSync(layout.dir)) {
    const self = resolve(ctx.execPath).toLowerCase().startsWith(resolve(layout.dir).toLowerCase())
    if (self && ctx.platform === 'win32') {
      deps.launch('cmd.exe', ['/d', '/s', '/c', `"ping -n 4 127.0.0.1 >nul & rmdir /s /q "${layout.dir}""`], { verbatim: true })
      deferred = true
    } else {
      rmSync(layout.dir, { recursive: true, force: true })
    }
    removed.push(layout.dir)
  }
  return { layout, removed, deferred }
}

// --- Navigateur et pont en marche ---------------------------------------

export function openBrowser(url: string, platform: string = process.platform, deps: Pick<InstallDeps, 'launch'> = systemDeps): boolean {
  const c = browserCommand(platform, url)
  if (!c) return false
  deps.launch(c.cmd, c.args, { verbatim: c.verbatim })
  return true
}

// Le pont répond-il sur ce port ? (/health, boucle locale)
export function bridgeResponds(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((done) => {
    const req = request({ host: '127.0.0.1', port, path: '/health', timeout: timeoutMs }, (res) => {
      res.resume()
      done(res.statusCode === 200)
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => done(false))
    req.end()
  })
}

export async function waitForBridge(port: number, totalMs: number, deps: Pick<InstallDeps, 'sleep'> = systemDeps): Promise<boolean> {
  const until = Date.now() + totalMs
  while (Date.now() < until) {
    if (await bridgeResponds(port)) return true
    await deps.sleep(400)
  }
  return false
}
