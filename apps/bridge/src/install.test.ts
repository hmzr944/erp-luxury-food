// Installation dans un dossier personnel temporaire : aucune commande
// système n'est lancée (launchctl, systemctl, wscript passent par de faux accès).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installBridge, readRunning, uninstallBridge, writeRunning, type InstallContext, type InstallDeps } from './install.js'

function fakeDeps(opts: { systemd?: boolean } = {}) {
  const alive = new Set<number>()
  const responding = new Set<number>()
  const calls: string[] = []
  const launched: string[] = []
  const killed: number[] = []
  const deps: InstallDeps = {
    run: (cmd, args) => {
      calls.push([cmd, ...args].join(' '))
      if (cmd === 'systemctl' && args[1] === 'show-environment') return opts.systemd !== false
      return true
    },
    launch: (cmd, args) => {
      launched.push([cmd, ...args].join(' '))
    },
    isAlive: (pid) => alive.has(pid),
    responds: async (port) => responding.has(port),
    kill: (pid) => {
      killed.push(pid)
      alive.delete(pid)
    },
    sleep: async () => {},
  }
  return { deps, alive, responding, calls, launched, killed }
}

describe('installation et désinstallation', () => {
  let root: string
  let ctx: InstallContext

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'flow-bridge-install-'))
    const download = join(root, 'Téléchargements')
    mkdirSync(download)
    writeFileSync(join(download, 'flow-bridge-linux-x64'), 'exécutable v1')
    ctx = {
      platform: 'linux',
      home: join(root, 'home'),
      env: {},
      execPath: join(download, 'flow-bridge-linux-x64'),
      configHome: join(root, 'home', '.flow-bridge'),
      uid: 501,
    }
    mkdirSync(ctx.configHome, { recursive: true })
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('Linux avec systemd : copie, unité, activation et démarrage', async () => {
    const f = fakeDeps()
    const r = await installBridge(ctx, f.deps)
    const exe = join(ctx.home, '.local/share/flow-bridge/flow-bridge')
    expect(r).toMatchObject({ method: 'systemd', copied: true, started: true, alreadyRunning: false })
    expect(readFileSync(exe, 'utf8')).toBe('exécutable v1')
    expect(statSync(exe).mode & 0o755).toBe(0o755)
    const unit = readFileSync(join(ctx.home, '.config/systemd/user/flow-bridge.service'), 'utf8')
    expect(unit).toContain(`ExecStart="${exe}" --arriere-plan`)
    expect(f.calls).toEqual([
      'systemctl --user show-environment',
      'systemctl --user daemon-reload',
      'systemctl --user enable flow-bridge.service',
      'systemctl --user restart flow-bridge.service',
    ])
    expect(existsSync(join(ctx.home, '.config/autostart/flow-bridge.desktop'))).toBe(false)
  })

  it('idempotent : relancé alors que le pont tourne, rien n’est recopié ni redémarré', async () => {
    const f = fakeDeps()
    await installBridge(ctx, f.deps)
    writeRunning(ctx.configHome, { pid: 4242, port: 51717, exe: 'x', startedAt: '' })
    f.alive.add(4242)
    f.responding.add(51717)
    f.calls.length = 0
    const r = await installBridge(ctx, f.deps)
    expect(r).toMatchObject({ copied: false, started: false, alreadyRunning: true })
    expect(f.calls).toEqual(['systemctl --user show-environment', 'systemctl --user enable flow-bridge.service'])
    expect(f.killed).toEqual([])
  })

  it('nouvelle version : l’ancien pont est arrêté, l’exécutable remplacé puis relancé', async () => {
    const f = fakeDeps()
    await installBridge(ctx, f.deps)
    writeRunning(ctx.configHome, { pid: 4242, port: 51717, exe: 'x', startedAt: '' })
    f.alive.add(4242)
    f.responding.add(51717)
    writeFileSync(ctx.execPath, 'exécutable v2')
    f.calls.length = 0
    const r = await installBridge(ctx, f.deps)
    expect(r).toMatchObject({ copied: true, started: true })
    expect(f.killed).toEqual([4242])
    expect(f.calls).toContain('systemctl --user stop flow-bridge.service')
    expect(f.calls.at(-1)).toBe('systemctl --user restart flow-bridge.service')
    expect(readFileSync(join(ctx.home, '.local/share/flow-bridge/flow-bridge'), 'utf8')).toBe('exécutable v2')
  })

  it('n’arrête jamais un processus qui ne répond pas comme le pont (numéro repris)', async () => {
    const f = fakeDeps()
    await installBridge(ctx, f.deps)
    writeRunning(ctx.configHome, { pid: 777, port: 51717, exe: 'x', startedAt: '' })
    f.alive.add(777)
    writeFileSync(ctx.execPath, 'exécutable v2')
    await installBridge(ctx, f.deps)
    expect(f.killed).toEqual([])
  })

  it('Linux sans systemd utilisateur : entrée .desktop et lancement immédiat', async () => {
    const f = fakeDeps({ systemd: false })
    const r = await installBridge(ctx, f.deps)
    expect(r.method).toBe('autostart')
    const exe = join(ctx.home, '.local/share/flow-bridge/flow-bridge')
    expect(readFileSync(join(ctx.home, '.config/autostart/flow-bridge.desktop'), 'utf8')).toContain('--arriere-plan')
    expect(f.launched).toEqual([`${exe} --arriere-plan`])
  })

  it('macOS : LaunchAgent écrit puis chargé dans la session graphique', async () => {
    ctx.platform = 'darwin'
    const f = fakeDeps()
    const r = await installBridge(ctx, f.deps)
    expect(r.method).toBe('LaunchAgent')
    const plist = join(ctx.home, 'Library/LaunchAgents/fr.flow.bridge.plist')
    expect(readFileSync(plist, 'utf8')).toContain(join(ctx.home, 'Library/Application Support/FLOW-Bridge/flow-bridge'))
    expect(f.calls).toEqual(['launchctl bootout gui/501/fr.flow.bridge', `launchctl bootstrap gui/501 ${plist}`])
  })

  it('l’exécutable déjà installé relancé : ni copie sur lui-même ni erreur', async () => {
    const f = fakeDeps()
    const first = await installBridge(ctx, f.deps)
    const r = await installBridge({ ...ctx, execPath: first.layout.exe }, f.deps)
    expect(r.copied).toBe(false)
  })

  it('désinstallation Linux : service retiré, pont arrêté, dossier supprimé, configuration gardée', async () => {
    const f = fakeDeps()
    await installBridge(ctx, f.deps)
    writeFileSync(join(ctx.configHome, 'config.json'), '{}')
    writeRunning(ctx.configHome, { pid: 4242, port: 51717, exe: 'x', startedAt: '' })
    f.alive.add(4242)
    f.responding.add(51717)
    f.calls.length = 0
    const r = await uninstallBridge(ctx, f.deps)
    expect(f.calls).toEqual(['systemctl --user disable --now flow-bridge.service', 'systemctl --user daemon-reload'])
    expect(f.killed).toEqual([4242])
    expect(r.deferred).toBe(false)
    expect(existsSync(join(ctx.home, '.local/share/flow-bridge'))).toBe(false)
    expect(existsSync(join(ctx.home, '.config/systemd/user/flow-bridge.service'))).toBe(false)
    expect(existsSync(join(ctx.configHome, 'config.json'))).toBe(true)
    // Rien à retirer la seconde fois
    expect((await uninstallBridge(ctx, f.deps)).removed).toEqual([])
  })

  it('désinstallation macOS : agent déchargé et supprimé', async () => {
    ctx.platform = 'darwin'
    const f = fakeDeps()
    await installBridge(ctx, f.deps)
    const r = await uninstallBridge(ctx, f.deps)
    expect(f.calls.at(-1)).toBe('launchctl bootout gui/501/fr.flow.bridge')
    expect(r.removed).toContain(join(ctx.home, 'Library/LaunchAgents/fr.flow.bridge.plist'))
    expect(existsSync(join(ctx.home, 'Library/Application Support/FLOW-Bridge'))).toBe(false)
  })

  it('fichier du processus en marche : relu, ignoré s’il est illisible', () => {
    writeRunning(ctx.configHome, { pid: 12, port: 51717, exe: '/x', startedAt: 't' })
    expect(readRunning(ctx.configHome)).toMatchObject({ pid: 12, port: 51717 })
    writeFileSync(join(ctx.configHome, 'bridge.pid'), 'pas du json')
    expect(readRunning(ctx.configHome)).toBeNull()
  })
})
