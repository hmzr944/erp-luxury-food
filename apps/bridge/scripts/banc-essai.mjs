#!/usr/bin/env node
// Banc d'essai sans matériel : faux TPE Caisse-AP et fausse imprimante ESC/POS
// sur le réseau local. À lancer après « pnpm --filter @erp/bridge build ».
//
//   node scripts/banc-essai.mjs            les deux
//   node scripts/banc-essai.mjs tpe        faux TPE seul (port 8888)
//   node scripts/banc-essai.mjs imprimante fausse imprimante seule (port 9100)
//
// Options : --manuel (accepter ou refuser chaque paiement au clavier),
//           --delai 3000 (durée d'une transaction en ms),
//           --port-tpe 8888, --port-imprimante 9100, --dossier ./tickets
// État de départ de la fausse imprimante (réponses à DLE EOT) :
//           --sans-papier, --capot-ouvert, --presque-fini, --hors-ligne,
//           --erreur-coupe, --muette (ne donne pas son état)
// Sans --manuel, une lettre puis Entrée change l'état en cours de banc :
//           p papier, c capot, f fin proche, h hors ligne, x coupe-papier,
//           m muette, r tout remettre en état, e afficher l'état

import { networkInterfaces } from 'node:os'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/bench/', import.meta.url))
let tpeMod, printerMod
try {
  tpeMod = await import(join(dist, 'fake-tpe.js'))
  printerMod = await import(join(dist, 'fake-printer.js'))
} catch {
  console.error('Construisez d’abord le pont : pnpm --filter @erp/bridge build')
  process.exit(1)
}

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const valued = new Set(['--delai', '--port-tpe', '--port-imprimante', '--dossier'])
const mode = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1])) ?? 'tout'
const manual = args.includes('--manuel')
const euros = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €'
const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)
const where = ips.length ? ips.join(', ') : '127.0.0.1'

const rl = manual ? createInterface({ input: process.stdin, output: process.stdout }) : null

// État de la fausse imprimante, relu à chaque demande DLE EOT du pont
const printerState = {
  paperEnd: args.includes('--sans-papier'),
  coverOpen: args.includes('--capot-ouvert'),
  paperNearEnd: args.includes('--presque-fini'),
  offline: args.includes('--hors-ligne'),
  cutterError: args.includes('--erreur-coupe'),
  silent: args.includes('--muette'),
}

if (mode === 'tout' || mode === 'tpe') {
  const port = Number(opt('port-tpe', 8888))
  await tpeMod.startFakeTpe({
    port,
    delayMs: Number(opt('delai', 2500)),
    onRequest: (r) => console.log(`\n[TPE] Demande de ${r.credit ? 'remboursement' : 'paiement'} : ${euros(r.amountCents)} (caisse ${r.register})`),
    decide: async (r) => {
      if (!rl) return tpeMod.defaultDecision(r)
      const a = (await rl.question('[TPE] Carte présentée. Accepter (o), refuser (n) ou abandon client (a) ? ')).trim().toLowerCase()
      return a === 'n' ? { accept: false, reason: '04' } : a === 'a' ? { accept: false, reason: '06' } : { accept: true }
    },
    onResponse: (r, d) => console.log(`[TPE] ${d.accept ? 'Accepté' : d.reason === '06' ? 'Abandon' : 'Refusé'} : ${euros(r.amountCents)}`),
  })
  console.log(`Faux TPE Caisse-AP prêt : ${where}, port ${port}.`)
  console.log(manual ? '  Mode manuel : vous décidez de chaque paiement.' : '  Accepte tout, sauf les montants en ,13 (refus bancaire).')
  console.log('  Dans FLŌW : Paramètres, Paiement, cocher « Envoyer les paiements par carte au TPE de la banque », TPE Caisse-AP (réseau), adresse ci-dessus.')
}

if (mode === 'tout' || mode === 'imprimante') {
  const port = Number(opt('port-imprimante', 9100))
  const folder = resolve(opt('dossier', 'tickets-banc'))
  mkdirSync(folder, { recursive: true })
  let n = 0
  await printerMod.startFakePrinter({
    port,
    state: () => printerState,
    onJob: (reading, raw, info) => {
      n++
      const file = join(folder, `ticket-${String(n).padStart(3, '0')}.bin`)
      writeFileSync(file, raw)
      console.log(`\n[Imprimante] Travail n° ${n} (${raw.length} octets, copie brute : ${file})`)
      console.log(`État demandé ${info.queries} fois, état actuel : ${printerMod.describeState(info.state)}`)
      if (info.state.paperEnd || info.state.coverOpen || info.state.cutterError || info.state.offline) {
        console.log('Attention : dans cet état, une vraie imprimante ne sortirait pas ce ticket tout de suite.')
      }
      console.log(printerMod.describeJob(reading))
    },
  })
  console.log(`Fausse imprimante ESC/POS prête : ${where}, port ${port}. État : ${printerMod.describeState(printerState)}.`)
  console.log('  Dans FLŌW : Paramètres, Impression, « Imprimante réseau », adresse ci-dessus et ce port.')
  if (!manual) {
    console.log('  Clavier (lettre puis Entrée) : p papier, c capot, f fin proche, h hors ligne, x coupe-papier, m muette, r tout remettre, e état.')
    const keys = createInterface({ input: process.stdin })
    const toggles = { p: 'paperEnd', c: 'coverOpen', f: 'paperNearEnd', h: 'offline', x: 'cutterError', m: 'silent' }
    keys.on('line', (line) => {
      const k = line.trim().toLowerCase()
      if (toggles[k]) printerState[toggles[k]] = !printerState[toggles[k]]
      else if (k === 'r') for (const key of Object.keys(printerState)) printerState[key] = false
      else if (k !== 'e') return
      console.log(`[Imprimante] État : ${printerMod.describeState(printerState)}`)
    })
  }
}
console.log('\nCtrl+C pour arrêter.')
