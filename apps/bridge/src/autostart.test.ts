import { describe, expect, it } from 'vitest'
import {
  browserCommand,
  desktopEntry,
  encodeVbs,
  hasDesktop,
  installLayout,
  launchAgentPlist,
  pairingPageUrl,
  shouldAutoInstall,
  systemdUnit,
  windowsStartupScript,
} from './autostart.js'

describe('emplacements par utilisateur', () => {
  it('Windows : %LOCALAPPDATA%\\FLOW-Bridge et dossier Démarrage', () => {
    const l = installLayout('win32', 'C:\\Users\\Hélène', { LOCALAPPDATA: 'C:\\Users\\Hélène\\AppData\\Local', APPDATA: 'C:\\Users\\Hélène\\AppData\\Roaming' })
    expect(l.exe).toBe('C:\\Users\\Hélène\\AppData\\Local\\FLOW-Bridge\\flow-bridge.exe')
    expect(l.startupScript).toBe('C:\\Users\\Hélène\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\FLOW-Bridge.vbs')
    // Sans variables : déduit du dossier personnel
    expect(installLayout('win32', 'C:\\Users\\Paul').dir).toBe('C:\\Users\\Paul\\AppData\\Local\\FLOW-Bridge')
  })

  it('macOS : Application Support et LaunchAgents', () => {
    const l = installLayout('darwin', '/Users/paul')
    expect(l.exe).toBe('/Users/paul/Library/Application Support/FLOW-Bridge/flow-bridge')
    expect(l.launchAgent).toBe('/Users/paul/Library/LaunchAgents/fr.flow.bridge.plist')
  })

  it('Linux : ~/.local/share/flow-bridge, systemd --user et autostart, XDG respecté', () => {
    const l = installLayout('linux', '/home/paul')
    expect(l.exe).toBe('/home/paul/.local/share/flow-bridge/flow-bridge')
    expect(l.systemdUnit).toBe('/home/paul/.config/systemd/user/flow-bridge.service')
    expect(l.desktopEntry).toBe('/home/paul/.config/autostart/flow-bridge.desktop')
    const x = installLayout('linux', '/home/paul', { XDG_DATA_HOME: '/data', XDG_CONFIG_HOME: '/cfg', })
    expect(x.dir).toBe('/data/flow-bridge')
    expect(x.systemdUnit).toBe('/cfg/systemd/user/flow-bridge.service')
    // Chemin relatif ignoré, comme le veut la spécification XDG
    expect(installLayout('linux', '/home/paul', { XDG_DATA_HOME: 'rel' }).dir).toBe('/home/paul/.local/share/flow-bridge')
  })
})

describe('fichiers de démarrage', () => {
  it('Windows : .vbs qui lance l’exécutable caché, en UTF-16 avec BOM', () => {
    const vbs = windowsStartupScript('C:\\Users\\Hélène\\AppData\\Local\\FLOW-Bridge\\flow-bridge.exe')
    expect(vbs).toContain('CreateObject("WScript.Shell")')
    // Guillemets doublés autour du chemin, style 0 (caché), sans attendre
    expect(vbs).toContain('shell.Run """C:\\Users\\Hélène\\AppData\\Local\\FLOW-Bridge\\flow-bridge.exe"" --arriere-plan", 0, False')
    expect(vbs).toContain('\r\n')
    const bytes = encodeVbs(vbs)
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe])
    expect(bytes.subarray(2).toString('utf16le')).toBe(vbs)
  })

  it('macOS : LaunchAgent RunAtLoad, KeepAlive, chemin échappé', () => {
    const plist = launchAgentPlist('/Users/a&b/Library/Application Support/FLOW-Bridge/flow-bridge')
    expect(plist).toContain('<key>Label</key>\n  <string>fr.flow.bridge</string>')
    expect(plist).toContain('<string>/Users/a&amp;b/Library/Application Support/FLOW-Bridge/flow-bridge</string>')
    expect(plist).toContain('<string>--arriere-plan</string>')
    expect(plist).toContain('<key>RunAtLoad</key>\n  <true/>')
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>/)
    expect(plist).toContain('<string>Aqua</string>')
  })

  it('Linux : unité systemd --user, chemin entre guillemets et % doublé', () => {
    const unit = systemdUnit('/home/jo 50%/.local/share/flow-bridge/flow-bridge')
    expect(unit).toContain('ExecStart="/home/jo 50%%/.local/share/flow-bridge/flow-bridge" --arriere-plan')
    expect(unit).toContain('Restart=on-failure')
    expect(unit).toContain('WantedBy=default.target')
  })

  it('Linux : entrée .desktop de repli, échappements de la spécification', () => {
    const d = desktopEntry('/home/jo $x/flow-bridge')
    expect(d).toContain('Exec="/home/jo \\\\$x/flow-bridge" --arriere-plan')
    expect(d).toContain('Terminal=false')
    expect(desktopEntry('/home/a%b/flow-bridge')).toContain('Exec="/home/a%%b/flow-bridge"')
  })

  it('aucun tiret cadratin dans les fichiers produits', () => {
    for (const t of [windowsStartupScript('C:\\x.exe'), launchAgentPlist('/x'), systemdUnit('/x'), desktopEntry('/x')]) expect(t).not.toContain('—')
  })
})

describe('premier lancement', () => {
  const base = { standalone: true, args: [] as string[], env: {}, platform: 'win32', interactive: true }

  it('s’installe au double-clic de l’exécutable autonome', () => {
    expect(shouldAutoInstall(base)).toBe(true)
  })

  it('pas d’installation : option, variable, arguments, pas de fenêtre, pont lancé avec Node.js', () => {
    expect(shouldAutoInstall({ ...base, env: { FLOW_BRIDGE_INSTALL: '0' } })).toBe(false)
    expect(shouldAutoInstall({ ...base, env: { FLOW_BRIDGE_INSTALL: 'non' } })).toBe(false)
    expect(shouldAutoInstall({ ...base, args: ['--sans-installation'] })).toBe(false)
    expect(shouldAutoInstall({ ...base, args: ['--arriere-plan'] })).toBe(false)
    expect(shouldAutoInstall({ ...base, interactive: false })).toBe(false)
    expect(shouldAutoInstall({ ...base, standalone: false })).toBe(false)
    expect(shouldAutoInstall({ ...base, platform: 'freebsd' })).toBe(false)
  })
})

describe('navigateur', () => {
  it('adresse d’appairage : code et port dans le fragment', () => {
    expect(pairingPageUrl('https://caisse.exemple.fr/', '012345', 51717)).toBe('https://caisse.exemple.fr/materiel#pont=012345&port=51717')
    expect(pairingPageUrl('https://exemple.fr/flow', '999999', 4000)).toBe('https://exemple.fr/flow/materiel#pont=999999&port=4000')
  })

  it('commande de chaque système, sans interprétation par cmd.exe', () => {
    const url = 'https://caisse.exemple.fr/materiel#pont=012345&port=51717'
    expect(browserCommand('darwin', url)).toEqual({ cmd: 'open', args: [url] })
    expect(browserCommand('linux', url)).toEqual({ cmd: 'xdg-open', args: [url] })
    expect(browserCommand('win32', url)).toEqual({ cmd: 'cmd.exe', args: ['/d', '/s', '/c', `start "" "${url}"`], verbatim: true })
    // Guillemets, %, ^, espaces : refusés plutôt que passés à cmd.exe
    for (const bad of ['https://x.fr/"&calc', 'https://x.fr/%PATH%', 'https://x.fr/a^b', 'https://x.fr/a b', 'file:///etc/passwd', 'javascript:alert(1)']) {
      expect(browserCommand('win32', bad)).toBeNull()
    }
  })

  it('bureau disponible', () => {
    expect(hasDesktop('win32', {})).toBe(true)
    expect(hasDesktop('win32', { FLOW_BRIDGE_NAVIGATEUR: '0' })).toBe(false)
    expect(hasDesktop('win32', { CI: 'true' })).toBe(false)
    expect(hasDesktop('darwin', {})).toBe(true)
    expect(hasDesktop('darwin', { SSH_CONNECTION: '1.2.3.4 22 5.6.7.8 22' })).toBe(false)
    expect(hasDesktop('linux', {})).toBe(false)
    expect(hasDesktop('linux', { DISPLAY: ':0' })).toBe(true)
    expect(hasDesktop('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true)
  })
})
