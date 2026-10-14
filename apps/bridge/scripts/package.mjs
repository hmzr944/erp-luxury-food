// Paquet téléchargeable de FLŌW-Bridge, servi par la caisse :
//   flow-bridge/flow-bridge.mjs           le pont en un seul fichier (Node.js 22)
//   flow-bridge/Démarrer FLŌW-Bridge.cmd  double-clic sous Windows
//   flow-bridge/Démarrer FLŌW-Bridge.command  double-clic sous macOS
//   flow-bridge/demarrer.sh               Linux
//   flow-bridge/LISEZMOI.txt
// Usage : node scripts/package.mjs [dossier de sortie]
// FLOW_APP_URL (ou NEXT_PUBLIC_APP_URL) : adresse de la caisse, acceptée d'office.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { zipSync, strToU8 } from 'fflate'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(process.argv[2] ?? join(ROOT, 'release'))
const appUrl = (process.env.FLOW_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

const result = await build({
  entryPoints: [join(ROOT, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  write: false,
  minify: false,
  legalComments: 'inline',
  // Accélérateurs natifs facultatifs de « ws » : absents, le pont s'en passe
  external: ['bufferutil', 'utf-8-validate'],
  define: { 'process.env.FLOW_BRIDGE_BUILD_ORIGINS': JSON.stringify(appUrl), 'process.env.FLOW_BRIDGE_BUILD_VERSION': JSON.stringify(version) },
  banner: { js: "import { createRequire as __flowRequire } from 'node:module'; const require = __flowRequire(import.meta.url);" },
})
const code = result.outputFiles[0].text

const readme = `FLŌW-Bridge ${version}
Pont local entre la caisse FLŌW (${appUrl}) et le matériel de la boutique :
imprimante ticket réseau, tiroir-caisse, imprimante A4, terminal de paiement.

1. Installez Node.js 22 ou plus récent : https://nodejs.org (version LTS).
2. Double-cliquez sur « Démarrer FLŌW-Bridge » (Windows : .cmd, macOS : .command ;
   Linux : ./demarrer.sh). Au premier lancement sous macOS : clic droit, Ouvrir.
3. Un code à six chiffres s'affiche. Sur la caisse : menu ⋮, Imprimante, tiroir
   et TPE, puis saisissez ce code.
4. Laissez la fenêtre ouverte pendant la journée.

Le pont n'écoute que sur cet ordinateur (127.0.0.1) et n'accepte que la caisse
${appUrl} et les caisses appairées par code.
`
const win = `@echo off\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul || (echo Node.js 22 est requis : https://nodejs.org & pause & exit /b 1)\r\nnode flow-bridge.mjs --pair\r\npause\r\n`
const mac = `#!/bin/sh\ncd "$(dirname "$0")"\ncommand -v node >/dev/null 2>&1 || { echo "Node.js 22 est requis : https://nodejs.org"; read _; exit 1; }\nnode flow-bridge.mjs --pair\n`

const exec = { attrs: 0o755 << 16, os: 3 }
const zip = zipSync(
  {
    'flow-bridge/flow-bridge.mjs': [strToU8(code), exec],
    'flow-bridge/Démarrer FLŌW-Bridge.cmd': strToU8(win),
    'flow-bridge/Démarrer FLŌW-Bridge.command': [strToU8(mac), exec],
    'flow-bridge/demarrer.sh': [strToU8(mac), exec],
    'flow-bridge/LISEZMOI.txt': strToU8(readme.replace(/\n/g, '\r\n')),
  },
  { level: 9 },
)
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'flow-bridge.zip'), zip)
writeFileSync(join(out, 'flow-bridge.json'), JSON.stringify({ version, size: zip.length, appUrl, builtAt: new Date().toISOString() }))
console.log(`FLŌW-Bridge ${version} : ${join(out, 'flow-bridge.zip')} (${Math.round(zip.length / 1024)} Ko, caisse ${appUrl})`)
