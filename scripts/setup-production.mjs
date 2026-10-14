#!/usr/bin/env node
// Première installation de FLŌW en production : identité de l'éditeur,
// adresses publiques, secrets générés, fichiers .env.production écrits.
//   pnpm setup:production            questions une à une
//   pnpm setup:production --non-interactive   lit les variables SETUP_*
//   pnpm setup:production --check    contrôle des .env.production existants
//   --force                          remplace des fichiers existants
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { checkApiEnv, checkWebEnv, generateSecrets, isDemoValue, parseEnv, serializeEnv, validSiren, validUrl } from './setup-lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API_ENV = join(ROOT, 'apps/api/.env.production')
const WEB_ENV = join(ROOT, 'apps/web/.env.production')
const args = new Set(process.argv.slice(2))
const force = args.has('--force')

function check() {
  let failed = false
  for (const [file, fn] of [[API_ENV, checkApiEnv], [WEB_ENV, checkWebEnv]]) {
    if (!existsSync(file)) {
      console.log(`✗ ${file} introuvable`)
      failed = true
      continue
    }
    const problems = fn(parseEnv(readFileSync(file, 'utf8')))
    console.log(problems.length ? `✗ ${file}` : `✓ ${file}`)
    problems.forEach((p) => console.log(`   - ${p}`))
    // Sans e-mail le produit fonctionne : simple avertissement
    if (problems.some((p) => !p.startsWith('RESEND_API_KEY') && !p.startsWith('NEXT_PUBLIC_BRIDGE_URL'))) failed = true
  }
  process.exit(failed ? 1 : 0)
}

async function ask() {
  if (args.has('--non-interactive')) {
    const e = process.env
    return {
      appUrl: e.SETUP_APP_URL, apiUrl: e.SETUP_API_URL, databaseUrl: e.SETUP_DATABASE_URL, redisUrl: e.SETUP_REDIS_URL ?? 'redis://localhost:6379',
      company: e.SETUP_EDITOR_COMPANY, siren: e.SETUP_EDITOR_SIREN, address: e.SETUP_EDITOR_ADDRESS, representative: e.SETUP_EDITOR_REPRESENTATIVE, city: e.SETUP_EDITOR_CITY,
      resendKey: e.SETUP_RESEND_API_KEY ?? '', resendFrom: e.SETUP_RESEND_FROM ?? '', stripeKey: e.SETUP_STRIPE_BILLING_SECRET_KEY ?? '',
    }
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const q = async (label, { valid, hint, optional } = {}) => {
    for (;;) {
      const v = (await rl.question(`${label}${optional ? ' (facultatif)' : ''} : `)).trim()
      if (!v && optional) return ''
      if (v && (!valid || valid(v))) return v
      console.log(`  ${hint ?? 'Valeur requise'}`)
    }
  }
  console.log('\nFLŌW, installation de production\n')
  const appUrl = await q('Adresse publique de la caisse (https://app.exemple.fr)', { valid: (v) => validUrl(v, { https: true }), hint: 'Adresse https attendue' })
  const apiUrl = await q('Adresse publique de l’API (https://api.exemple.fr)', { valid: (v) => validUrl(v, { https: true }), hint: 'Adresse https attendue' })
  const databaseUrl = await q('Base PostgreSQL (postgresql://…)', { valid: (v) => /^postgres(ql)?:\/\//.test(v), hint: 'postgresql://utilisateur:motdepasse@hôte:5432/base' })
  const redisUrl = await q('Redis (redis://…)', { valid: (v) => /^rediss?:\/\//.test(v), hint: 'redis://hôte:6379' })
  console.log('\nÉditeur du logiciel, porté sur l’attestation individuelle (art. 286 CGI)')
  const company = await q('Raison sociale de l’éditeur', { valid: (v) => !isDemoValue(v), hint: 'Valeur de démonstration refusée' })
  const siren = await q('SIREN de l’éditeur (9 chiffres)', { valid: validSiren, hint: 'SIREN invalide' })
  const address = await q('Adresse du siège')
  const representative = await q('Représentant légal (prénom nom, fonction)')
  const city = await q('Ville de signature')
  console.log('\nE-mails (tickets, factures, alertes), par Resend')
  const resendKey = await q('Clé Resend', { optional: true, valid: (v) => !isDemoValue(v), hint: 'Valeur de démonstration refusée' })
  const resendFrom = resendKey ? await q('Expéditeur (FLŌW <noreply@exemple.fr>)') : ''
  const stripeKey = await q('Clé Stripe Billing (abonnements)', { optional: true })
  rl.close()
  return { appUrl, apiUrl, databaseUrl, redisUrl, company, siren, address, representative, city, resendKey, resendFrom, stripeKey }
}

async function main() {
  if (args.has('--check')) return check()
  for (const f of [API_ENV, WEB_ENV]) {
    if (existsSync(f) && !force) {
      console.error(`${f} existe déjà. Relancez avec --force pour le remplacer, ou --check pour le contrôler.`)
      process.exit(1)
    }
  }
  const a = await ask()
  const errors = []
  if (!validUrl(a.appUrl, { https: true })) errors.push('adresse de la caisse')
  if (!validUrl(a.apiUrl, { https: true })) errors.push('adresse de l’API')
  if (!a.databaseUrl) errors.push('base PostgreSQL')
  if (!a.company || isDemoValue(a.company)) errors.push('raison sociale de l’éditeur')
  if (!validSiren(a.siren)) errors.push('SIREN de l’éditeur')
  for (const k of ['address', 'representative', 'city']) if (!a[k]) errors.push(k)
  if (errors.length) {
    console.error(`Valeurs manquantes ou invalides : ${errors.join(', ')}`)
    process.exit(1)
  }
  const s = generateSecrets()
  const app = a.appUrl.replace(/\/+$/, '')
  const api = a.apiUrl.replace(/\/+$/, '')
  const apiEnv = [
    ['NODE_ENV', 'production'], ['PORT', '3001'],
    ['DATABASE_URL', a.databaseUrl], ['REDIS_URL', a.redisUrl], ['FRONTEND_URL', app],
    ['# Secrets générés par setup:production : à garder hors du dépôt'],
    ['JWT_SECRET', s.JWT_SECRET], ['JWT_REFRESH_SECRET', s.JWT_REFRESH_SECRET], ['JWT_EXPIRES_IN', '15m'], ['JWT_REFRESH_EXPIRES_IN', '30d'],
    ['SECRETS_KEY', s.SECRETS_KEY], ['PIN_SECRET', s.PIN_SECRET],
    ['# Conformité fiscale (art. 286 CGI) : éditeur et clé de signature'],
    ['EDITOR_COMPANY', a.company], ['EDITOR_SIREN', a.siren.replace(/\D/g, '')], ['EDITOR_ADDRESS', a.address], ['EDITOR_REPRESENTATIVE', a.representative], ['EDITOR_CITY', a.city],
    ['FISCAL_SIGNING_KEY', s.FISCAL_SIGNING_KEY], ['FISCAL_AUTO_CLOSE', 'on'], ['ROUTINE_ALERTS', 'on'],
    ['# E-mails et abonnements'],
    ['RESEND_API_KEY', a.resendKey], ['RESEND_FROM', a.resendFrom], ['STRIPE_BILLING_SECRET_KEY', a.stripeKey],
  ]
  const webEnv = [
    ['NEXT_PUBLIC_APP_URL', app], ['NEXT_PUBLIC_API_URL', api], ['NEXT_PUBLIC_WS_URL', api.replace(/^http/, 'ws')],
    ['# Pont local : wss après « flow-bridge cert » (voir docs/installation-production.md)'],
    ['NEXT_PUBLIC_BRIDGE_URL', 'wss://localhost:51717'],
  ]
  writeFileSync(API_ENV, serializeEnv(apiEnv, ['FLŌW API, production. Généré par pnpm setup:production.']), { mode: 0o600 })
  chmodSync(API_ENV, 0o600)
  writeFileSync(WEB_ENV, serializeEnv(webEnv, ['FLŌW caisse web, production. Généré par pnpm setup:production.']))
  console.log(`\n✓ ${API_ENV} (droits 600)\n✓ ${WEB_ENV}`)
  console.log('  Secrets générés : JWT, chiffrement, code vendeur, clé de signature fiscale (non affichés).')
  if (!a.resendKey) console.log('  Attention : sans clé Resend, aucun e-mail ne partira.')
  console.log(`
Ensuite :
  1. pnpm install --frozen-lockfile
  2. cd apps/api && npx dotenv -e .env.production -- npx prisma migrate deploy
     (ne lancez pas le jeu de démonstration « db:seed » en production)
  3. pnpm build
  4. Démarrer l'API (node apps/api/dist/main.js) et la caisse (next start) avec ces fichiers
  5. pnpm setup:production --check
  6. Sur chaque ordinateur de boutique : FLŌW-Bridge, puis « flow-bridge cert » (docs/installation-production.md)
`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
