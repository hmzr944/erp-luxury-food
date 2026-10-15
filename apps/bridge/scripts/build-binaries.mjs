// Exécutables autonomes de FLŌW-Bridge (sans Node.js à installer), par
// « Single Executable Applications » de Node.js :
//   1. le pont est construit en un seul script CommonJS (bundle.mjs) ;
//   2. node --experimental-sea-config en fait un « blob » ;
//   3. le binaire officiel de Node.js (nodejs.org, empreinte SHA-256 vérifiée)
//      reçoit ce blob grâce à postject.
//
// Usage : node scripts/build-binaries.mjs [--targets linux-x64,windows-x64,...] [--out dossier]
//   Cibles : windows-x64, macos-arm64, macos-x64, linux-x64 (toutes par défaut).
//   FLOW_APP_URL (ou NEXT_PUBLIC_APP_URL) : adresse de la caisse inscrite dans le pont.
//   FLOW_BRIDGE_NODE_VERSION : version de Node.js embarquée (défaut ci-dessous).
//
// Sous macOS, les binaires sont re-signés (signature ad hoc « codesign --sign - »,
// ou FLOW_BRIDGE_CODESIGN_IDENTITY) et un binaire universel est produit.
// Ailleurs, les binaires macOS sont produits mais NON signés : un Mac Apple
// Silicon refuse de les lancer tant qu'ils n'ont pas été signés sur un Mac.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { zipSync } from 'fflate'
import { ROOT, bundleBridge } from './bundle.mjs'

const NODE_VERSION = process.env.FLOW_BRIDGE_NODE_VERSION || 'v22.23.3'
const POSTJECT = 'postject@1.0.0-alpha.6'
// Valeurs fixées par Node.js pour les exécutables autonomes
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const SEA_RESOURCE = 'NODE_SEA_BLOB'
const MACHO_SEGMENT = 'NODE_SEA'

const TARGETS = {
  'windows-x64': { os: 'win32', arch: 'x64', dist: 'win-x64/node.exe', out: 'flow-bridge-windows-x64.exe' },
  'macos-arm64': { os: 'darwin', arch: 'arm64', dist: `node-${NODE_VERSION}-darwin-arm64.tar.gz`, out: 'flow-bridge-macos-arm64' },
  'macos-x64': { os: 'darwin', arch: 'x64', dist: `node-${NODE_VERSION}-darwin-x64.tar.gz`, out: 'flow-bridge-macos-x64' },
  'linux-x64': { os: 'linux', arch: 'x64', dist: `node-${NODE_VERSION}-linux-x64.tar.gz`, out: 'flow-bridge-linux-x64' },
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}

const targets = (arg('--targets') ?? Object.keys(TARGETS).join(',')).split(',').map((t) => t.trim()).filter(Boolean)
for (const t of targets) if (!TARGETS[t]) throw new Error(`Cible inconnue : ${t} (connues : ${Object.keys(TARGETS).join(', ')})`)
const out = resolve(arg('--out') ?? join(ROOT, 'dist/bin'))
const cache = resolve(process.env.FLOW_BRIDGE_SEA_CACHE || join(ROOT, 'node_modules/.cache/flow-bridge-sea'), NODE_VERSION)
const work = join(cache, 'work')
const isMac = process.platform === 'darwin'

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' && /^(npx|npm)$/.test(cmd), ...opts })
}

// Derrière un proxy d'entreprise : NODE_USE_ENV_PROXY=1 et HTTPS_PROXY
async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

let shasums
async function nodeBinary(key) {
  const t = TARGETS[key]
  const base = `https://nodejs.org/dist/${NODE_VERSION}/`
  if (!shasums) {
    const file = join(cache, 'SHASUMS256.txt')
    if (!existsSync(file)) await download(base + 'SHASUMS256.txt', file)
    shasums = new Map(
      readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => l.trim().split(/\s+/))
        .filter((p) => p.length === 2)
        .map(([h, f]) => [f, h]),
    )
  }
  const expected = shasums.get(t.dist)
  if (!expected) throw new Error(`${t.dist} absent de SHASUMS256.txt (${NODE_VERSION})`)
  const archive = join(cache, t.dist.replace(/\//g, '_'))
  if (!existsSync(archive) || sha256(archive) !== expected) {
    console.log(`Téléchargement de ${base}${t.dist}`)
    await download(base + t.dist, archive)
    const got = sha256(archive)
    if (got !== expected) {
      rmSync(archive, { force: true })
      throw new Error(`Empreinte SHA-256 incorrecte pour ${t.dist} : ${got}, attendu ${expected}`)
    }
  }
  if (!t.dist.endsWith('.tar.gz')) return archive
  // Extraction du seul binaire « bin/node » de l'archive
  const dir = join(cache, key)
  const inner = `${t.dist.replace(/\.tar\.gz$/, '')}/bin/node`
  const bin = join(dir, inner)
  if (!existsSync(bin)) {
    mkdirSync(dir, { recursive: true })
    run('tar', ['-xzf', archive, '-C', dir, inner])
  }
  return bin
}

// Retire la signature Authenticode de node.exe : après injection elle serait
// invalide, ce qui est pire qu'une absence de signature
function stripAuthenticode(buf) {
  const pe = buf.readUInt32LE(0x3c)
  if (buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('node.exe : en-tête PE introuvable')
  const opt = pe + 24
  const magic = buf.readUInt16LE(opt)
  const security = opt + (magic === 0x20b ? 112 : 96) + 4 * 8
  const offset = buf.readUInt32LE(security)
  const size = buf.readUInt32LE(security + 4)
  if (!offset || !size) return buf
  buf.writeUInt32LE(0, security)
  buf.writeUInt32LE(0, security + 4)
  buf.writeUInt32LE(0, opt + 64) // somme de contrôle, recalculée inutilement par Windows
  // La table des certificats est en fin de fichier (alignée sur 8 octets)
  return offset + size >= buf.length - 8 ? buf.subarray(0, offset) : buf
}

function zipExecutable(binary, zipPath, name) {
  const zip = zipSync({ [name]: [readFileSync(binary), { attrs: 0o755 << 16, os: 3 }] }, { level: 6 })
  writeFileSync(zipPath, zip)
}

// --- Construction -------------------------------------------------------

mkdirSync(work, { recursive: true })
mkdirSync(out, { recursive: true })

const { code, appUrl, version } = await bundleBridge({ format: 'cjs' })
const main = join(work, 'flow-bridge.cjs')
const blob = join(work, 'flow-bridge.blob')
const seaConfig = join(work, 'sea-config.json')
writeFileSync(main, code)
writeFileSync(
  seaConfig,
  JSON.stringify(
    {
      main,
      output: blob,
      // Pas d'avertissement « expérimental » dans la fenêtre du commerçant
      disableExperimentalSEAWarning: true,
      // Le cache de code et l'instantané V8 sont propres à la plateforme qui
      // construit : désactivés pour produire tous les systèmes depuis un seul
      useCodeCache: false,
      useSnapshot: false,
    },
    null,
    2,
  ),
)

// Le blob doit être produit par la même version de Node.js que celle embarquée
let generator = process.execPath
if (process.version !== NODE_VERSION) {
  const host = Object.keys(TARGETS).find((k) => TARGETS[k].os === process.platform && TARGETS[k].arch === process.arch)
  if (!host) throw new Error(`Plateforme ${process.platform}-${process.arch} non prise en charge pour produire le blob : utilisez Node.js ${NODE_VERSION}`)
  generator = await nodeBinary(host)
}
run(generator, ['--experimental-sea-config', seaConfig])

const built = []
for (const key of targets) {
  const t = TARGETS[key]
  const src = await nodeBinary(key)
  const dest = join(out, t.out)
  rmSync(dest, { force: true })
  if (t.os === 'win32') writeFileSync(dest, stripAuthenticode(readFileSync(src)))
  else copyFileSync(src, dest)
  chmodSync(dest, 0o755)
  if (t.os === 'darwin' && isMac) run('codesign', ['--remove-signature', dest])

  const inject = ['--yes', POSTJECT, dest, SEA_RESOURCE, blob, '--sentinel-fuse', SEA_FUSE]
  if (t.os === 'darwin') inject.push('--macho-segment-name', MACHO_SEGMENT)
  console.log(`Injection : ${t.out}`)
  run('npx', inject)

  if (t.os === 'darwin') {
    if (isMac) sign(dest)
    else console.warn(`ATTENTION : ${t.out} n'est pas signé. Signez-le sur un Mac (codesign --sign - ${t.out}) avant de le distribuer.`)
    zipExecutable(dest, `${dest}.zip`, 'FLOW-Bridge')
    built.push(`${t.out}.zip`)
  }
  built.push(t.out)
}

function sign(file) {
  const identity = process.env.FLOW_BRIDGE_CODESIGN_IDENTITY || '-'
  const args = ['--sign', identity, '--force']
  // Signature Developer ID : runtime renforcé, exigé par la notarisation
  if (identity !== '-') args.push('--options', 'runtime', '--timestamp', '--entitlements', join(ROOT, 'scripts/entitlements.mac.plist'))
  run('codesign', [...args, file])
  run('codesign', ['--verify', '--verbose', file])
}

// Mac : un seul téléchargement pour Apple Silicon et Intel
if (isMac && targets.includes('macos-arm64') && targets.includes('macos-x64')) {
  const universal = join(out, 'flow-bridge-macos-universal')
  rmSync(universal, { force: true })
  run('lipo', ['-create', '-output', universal, join(out, TARGETS['macos-arm64'].out), join(out, TARGETS['macos-x64'].out)])
  sign(universal)
  zipExecutable(universal, `${universal}.zip`, 'FLOW-Bridge')
  built.push('flow-bridge-macos-universal', 'flow-bridge-macos-universal.zip')
}

const sums = built.map((f) => `${sha256(join(out, f))}  ${f}`).join('\n') + '\n'
writeFileSync(join(out, `SHASUMS256-${targets.join('+')}.txt`), sums)
writeFileSync(join(out, 'flow-bridge-binaries.json'), JSON.stringify({ version, node: NODE_VERSION, appUrl, files: built, builtAt: new Date().toISOString() }, null, 2))
for (const f of built) console.log(`${f}  ${(statSync(join(out, f)).size / 1048576).toFixed(1)} Mo`)
console.log(`FLŌW-Bridge ${version} (Node.js ${NODE_VERSION}, caisse ${appUrl}) : ${out}`)
