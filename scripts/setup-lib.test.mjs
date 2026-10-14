import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import { checkApiEnv, checkWebEnv, envValue, generateSecrets, isDemoValue, parseEnv, serializeEnv, validSiren } from './setup-lib.mjs'

test('SIREN : clé de Luhn, zéros refusés', () => {
  assert.equal(validSiren('732 829 320'), true)
  assert.equal(validSiren('732829321'), false)
  assert.equal(validSiren('000000000'), false)
})

test('valeurs de démonstration repérées', () => {
  for (const v of ['change-me-in-production-min-32-chars', 'your-resend-key', 'Éditeur de démonstration SAS', '000000000']) assert.equal(isDemoValue(v), true, v)
  assert.equal(isDemoValue('Maison Exemple SAS'), false)
})

test('secrets générés au bon format, clé fiscale lisible par l’API', () => {
  const s = generateSecrets()
  assert.match(s.SECRETS_KEY, /^[0-9a-f]{64}$/)
  assert.ok(s.JWT_SECRET.length >= 32 && s.JWT_SECRET !== s.JWT_REFRESH_SECRET)
  assert.ok(!s.FISCAL_SIGNING_KEY.includes('\n'))
  const key = createPrivateKey(s.FISCAL_SIGNING_KEY.replace(/\\n/g, '\n'))
  assert.equal(key.asymmetricKeyDetails.namedCurve, 'prime256v1')
})

test('fichier .env : écriture puis relecture identiques', () => {
  const s = generateSecrets()
  const entries = [['A', 'simple'], ['B', 'avec espace "et guillemets"'], ['FISCAL_SIGNING_KEY', s.FISCAL_SIGNING_KEY], ['# commentaire'], ['C', '']]
  const back = parseEnv(serializeEnv(entries, ['en-tête']))
  assert.equal(back.A, 'simple')
  assert.equal(back.B, 'avec espace "et guillemets"')
  assert.equal(back.FISCAL_SIGNING_KEY, s.FISCAL_SIGNING_KEY)
  assert.equal(back.C, '')
  assert.equal(envValue(''), '')
})

test('contrôle : la configuration de démonstration est refusée, la bonne passe', () => {
  const demo = parseEnv('NODE_ENV=development\nJWT_SECRET=change-me-in-production-min-32-chars\nEDITOR_SIREN=000000000\nFRONTEND_URL=http://localhost:3000')
  const problems = checkApiEnv(demo)
  assert.ok(problems.some((p) => p.includes('EDITOR_SIREN')))
  assert.ok(problems.some((p) => p.includes('NODE_ENV')))
  assert.ok(problems.some((p) => p.includes('FRONTEND_URL')))
  const s = generateSecrets()
  const good = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@db:5432/flow', REDIS_URL: 'redis://r:6379', FRONTEND_URL: 'https://app.exemple.fr', EDITOR_COMPANY: 'Exemple SAS', EDITOR_SIREN: '732829320', EDITOR_ADDRESS: '1 rue X, Paris', EDITOR_REPRESENTATIVE: 'A. B., président', EDITOR_CITY: 'Paris', RESEND_API_KEY: 're_123', ...s }
  assert.deepEqual(checkApiEnv(good), [])
  assert.deepEqual(checkWebEnv({ NEXT_PUBLIC_API_URL: 'https://api.exemple.fr', NEXT_PUBLIC_APP_URL: 'https://app.exemple.fr', NEXT_PUBLIC_WS_URL: 'wss://api.exemple.fr', NEXT_PUBLIC_BRIDGE_URL: 'wss://localhost:51717' }), [])
})
