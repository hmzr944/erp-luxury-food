// Démarrage automatique du pont avec la session, sans droits administrateur.
// Ce module ne fait que calculer : chemins, contenu des fichiers de démarrage
// et commandes à lancer. Les effets (copie, écriture, launchctl, systemctl)
// sont dans install.ts, qui reçoit ces valeurs.
//
// - Windows : copie dans %LOCALAPPDATA%\FLOW-Bridge et petit script .vbs
//   dans le dossier Démarrage de l'utilisateur. wscript.exe est présent sur
//   toutes les versions de Windows et lance l'exécutable sans fenêtre
//   (style 0) ; un raccourci .lnk ouvrirait une console visible, et une clé
//   « Run » du registre aussi. Rien à installer, rien à signer en plus.
// - macOS : copie dans ~/Library/Application Support/FLOW-Bridge et
//   LaunchAgent dans ~/Library/LaunchAgents (RunAtLoad, KeepAlive).
// - Linux : copie dans ~/.local/share/flow-bridge et unité systemd --user ;
//   sans systemd utilisateur, entrée .desktop dans ~/.config/autostart.

import { posix, win32 } from 'node:path'

export type InstallPlatform = 'win32' | 'darwin' | 'linux'

export const LAUNCH_AGENT_LABEL = 'fr.flow.bridge'
export const SYSTEMD_UNIT = 'flow-bridge.service'
// Argument passé par le démarrage automatique : pas de console, pas
// d'installation, journal dans un fichier
export const BACKGROUND_FLAG = '--arriere-plan'

export function isInstallPlatform(p: string): p is InstallPlatform {
  return p === 'win32' || p === 'darwin' || p === 'linux'
}

export interface InstallLayout {
  platform: InstallPlatform
  // Dossier stable par utilisateur et chemin de l'exécutable copié
  dir: string
  exe: string
  // Windows : script du dossier Démarrage
  startupScript?: string
  // macOS : LaunchAgent
  launchAgent?: string
  // Linux : unité systemd --user et repli .desktop
  systemdUnit?: string
  desktopEntry?: string
}

// Chemins par utilisateur. `home` et `env` sont injectés : les tests
// travaillent dans un dossier temporaire.
export function installLayout(platform: InstallPlatform, home: string, env: NodeJS.ProcessEnv = {}): InstallLayout {
  if (platform === 'win32') {
    const p = win32
    const local = env.LOCALAPPDATA || p.join(home, 'AppData', 'Local')
    const roaming = env.APPDATA || p.join(home, 'AppData', 'Roaming')
    const dir = p.join(local, 'FLOW-Bridge')
    return {
      platform,
      dir,
      exe: p.join(dir, 'flow-bridge.exe'),
      startupScript: p.join(roaming, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'FLOW-Bridge.vbs'),
    }
  }
  if (platform === 'darwin') {
    const p = posix
    const dir = p.join(home, 'Library', 'Application Support', 'FLOW-Bridge')
    return {
      platform,
      dir,
      exe: p.join(dir, 'flow-bridge'),
      launchAgent: p.join(home, 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`),
    }
  }
  const p = posix
  const data = env.XDG_DATA_HOME && p.isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : p.join(home, '.local', 'share')
  const config = env.XDG_CONFIG_HOME && p.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : p.join(home, '.config')
  const dir = p.join(data, 'flow-bridge')
  return {
    platform,
    dir,
    exe: p.join(dir, 'flow-bridge'),
    systemdUnit: p.join(config, 'systemd', 'user', SYSTEMD_UNIT),
    desktopEntry: p.join(config, 'autostart', 'flow-bridge.desktop'),
  }
}

// --- Windows : script .vbs ----------------------------------------------

// Chaîne VBScript : les guillemets se doublent
function vbsString(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

// Lancé par wscript.exe à l'ouverture de session : style de fenêtre 0
// (cachée), sans attendre la fin. Le fichier est écrit en UTF-16 avec BOM
// (voir encodeVbs) pour qu'un nom d'utilisateur accentué reste lisible.
export function windowsStartupScript(exe: string): string {
  const command = `"${exe}" ${BACKGROUND_FLAG}`
  return [
    "' FLOW-Bridge : démarrage du pont avec la session, sans fenêtre.",
    "' Pour l'enlever : flow-bridge desinstaller (ou supprimer ce fichier).",
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run ${vbsString(command)}, 0, False`,
    '',
  ].join('\r\n')
}

export function encodeVbs(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
}

// --- macOS : LaunchAgent ------------------------------------------------

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// KeepAlive avec SuccessfulExit à faux : relancé après un plantage, pas
// après un arrêt normal (le pont s'arrête proprement s'il tourne déjà).
// LimitLoadToSessionType Aqua : seulement dans une session graphique.
export function launchAgentPlist(exe: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(exe)}</string>
    <string>${BACKGROUND_FLAG}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>
`
}

// --- Linux : systemd --user et .desktop ---------------------------------

// Argument de ExecStart : guillemets, antislash échappés, % doublé (spécificateurs)
function systemdArg(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%')}"`
}

export function systemdUnit(exe: string): string {
  return `[Unit]
Description=FLOW-Bridge, pont entre la caisse FLOW et le matériel du magasin
After=graphical-session.target

[Service]
Type=simple
ExecStart=${systemdArg(exe)} ${BACKGROUND_FLAG}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
}

// Spécification Desktop Entry : guillemets autour de l'argument, \\ " \` $
// échappés, puis antislash doublé par l'échappement des chaînes, % doublé
function desktopArg(s: string): string {
  const quoted = `"${s.replace(/([\\"`$])/g, '\\$1')}"`
  return quoted.replace(/\\/g, '\\\\').replace(/%/g, '%%')
}

export function desktopEntry(exe: string): string {
  return `[Desktop Entry]
Type=Application
Name=FLOW-Bridge
Comment=Pont entre la caisse FLOW et le matériel du magasin
Exec=${desktopArg(exe)} ${BACKGROUND_FLAG}
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
`
}

// --- Lancement au premier double-clic ------------------------------------

export interface AutoInstallInput {
  standalone: boolean
  args: string[]
  env: NodeJS.ProcessEnv
  platform: string
  interactive: boolean
}

// Variable FLOW_BRIDGE_INSTALL=0 ou option --sans-installation : le pont
// tourne dans sa fenêtre, comme avant, sans rien copier
export const NO_INSTALL_FLAG = '--sans-installation'

export function installDisabled(args: string[], env: NodeJS.ProcessEnv): boolean {
  if (args.includes(NO_INSTALL_FLAG)) return true
  const v = (env.FLOW_BRIDGE_INSTALL ?? '').trim().toLowerCase()
  return ['0', 'non', 'false', 'off'].includes(v)
}

// Exécutable autonome lancé sans argument par une personne (double-clic)
export function shouldAutoInstall(i: AutoInstallInput): boolean {
  return i.standalone && i.args.length === 0 && i.interactive && isInstallPlatform(i.platform) && !installDisabled(i.args, i.env)
}

// --- Navigateur ---------------------------------------------------------

// Adresse ouverte pour appairer la caisse de cet ordinateur. Le code reste
// dans le fragment (#) : le navigateur ne l'envoie jamais au serveur web.
export function pairingPageUrl(appUrl: string, code: string, port: number): string {
  return `${appUrl.replace(/\/+$/, '')}/materiel#pont=${encodeURIComponent(code)}&port=${port}`
}

// Session avec un bureau où ouvrir un navigateur. FLOW_BRIDGE_NAVIGATEUR=0
// l'interdit (serveur, essais automatiques).
export function hasDesktop(platform: string, env: NodeJS.ProcessEnv): boolean {
  const v = (env.FLOW_BRIDGE_NAVIGATEUR ?? '').trim().toLowerCase()
  if (['0', 'non', 'false', 'off'].includes(v)) return false
  if (env.CI) return false
  if (platform === 'win32') return true
  if (platform === 'darwin') return !env.SSH_CONNECTION && !env.SSH_TTY
  if (platform === 'linux') return !!(env.DISPLAY || env.WAYLAND_DISPLAY)
  return false
}

// Seuls des caractères sans signification pour cmd.exe passent : l'adresse
// vient de la construction, mais elle ne doit jamais devenir une commande
const SAFE_URL = /^https?:\/\/[A-Za-z0-9.\-_~:/?#=&+,;@[\]]+$/

export function browserCommand(platform: string, url: string): { cmd: string; args: string[]; verbatim?: boolean } | null {
  if (!SAFE_URL.test(url)) return null
  if (platform === 'win32') {
    // « start » de cmd.exe ; l'adresse entre guillemets garde le « & » du fragment
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', `start "" "${url}"`], verbatim: true }
  }
  if (platform === 'darwin') return { cmd: 'open', args: [url] }
  if (platform === 'linux') return { cmd: 'xdg-open', args: [url] }
  return null
}
