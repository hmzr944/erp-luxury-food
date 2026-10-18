// Essai de fumée d'un exécutable autonome : il démarre dans un dossier
// temporaire, affiche un code d'appairage, répond sur /health, accepte
// l'appairage par WebSocket puis « bridge.hello » avec le jeton obtenu.
// Usage : node scripts/smoke-test.mjs dist/bin/flow-bridge-linux-x64
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import WebSocket from 'ws'

const binary = resolve(process.argv[2] ?? '')
const ORIGIN = 'http://localhost:3000'

function fail(msg) {
  console.error(`ÉCHEC : ${msg}`)
  process.exitCode = 1
  throw new Error(msg)
}

const freePort = () =>
  new Promise((ok, ko) => {
    const s = createServer()
    s.once('error', ko)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

const version = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim()
console.log(`--version : ${version}`)

const home = mkdtempSync(join(tmpdir(), 'flow-bridge-smoke-'))
const port = await freePort()
const child = spawn(binary, [], {
  env: { ...process.env, FLOW_BRIDGE_HOME: home, FLOW_BRIDGE_PORT: String(port), FLOW_BRIDGE_ORIGINS: ORIGIN },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', (d) => (output += d))
child.stderr.on('data', (d) => (output += d))

try {
  const code = await new Promise((ok, ko) => {
    const timer = setTimeout(() => ko(new Error('pas de code d’appairage après 30 s')), 30_000)
    const check = () => {
      const m = output.match(/Code d'appairage : (\d{3}) (\d{3})/)
      if (m) {
        clearTimeout(timer)
        ok(m[1] + m[2])
      }
    }
    child.stdout.on('data', check)
    child.once('exit', (c) => ko(new Error(`arrêt prématuré (code ${c})`)))
  }).catch((e) => fail(e.message))
  console.log(`Code d'appairage affiché : ${code}`)

  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
  if (health.name !== 'FLŌW-Bridge') fail(`/health inattendu : ${JSON.stringify(health)}`)
  console.log(`/health : ${JSON.stringify(health)}`)

  const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin: ORIGIN })
  await new Promise((ok, ko) => ws.once('open', ok).once('error', ko))
  let next = 0
  const call = (method, params) =>
    new Promise((ok, ko) => {
      const id = ++next
      const onMessage = (raw) => {
        const msg = JSON.parse(String(raw))
        if (msg.id !== id) return
        ws.off('message', onMessage)
        if (msg.error) ko(new Error(`${method} : ${msg.error.code} ${msg.error.message}`))
        else ok(msg.result)
      }
      ws.on('message', onMessage)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const paired = await call('bridge.pair', { code, name: 'Essai' })
  if (!paired.token) fail('bridge.pair sans jeton')
  console.log(`bridge.pair : caisse « ${paired.name} » appairée`)
  const hello = await call('bridge.hello', { token: paired.token })
  console.log(`bridge.hello : version ${hello.version}, ${hello.capabilities.length} capacités`)
  ws.close()

  // Connexion sécurisée : certificat fabriqué par le pont, vérifié avec son autorité
  const ca = readFileSync(join(home, 'tls', 'autorite.pem'))
  const wss = new WebSocket(`wss://localhost:${port}`, { origin: ORIGIN, ca, rejectUnauthorized: true })
  await new Promise((ok, ko) => wss.once('open', ok).once('error', ko))
  wss.close()
  const cer = await fetch(`http://127.0.0.1:${port}/certificat/flow-bridge.cer`)
  if (cer.headers.get('content-type') !== 'application/x-x509-ca-cert') fail('certificat de l’autorité non servi')
  console.log('wss:// vérifié avec l’autorité du pont, certificat téléchargeable')
  console.log('Essai réussi.')
} catch (e) {
  if (!process.exitCode) fail(e.message)
} finally {
  child.kill()
  await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)))
  if (process.exitCode) console.error(`Sortie de l'exécutable :\n${output}`)
  else console.log(`Sortie de l'exécutable :\n${output}`)
  rmSync(home, { recursive: true, force: true })
}
