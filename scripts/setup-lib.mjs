// Fonctions pures du script d'installation (testées sans réseau ni disque)
import { generateKeyPairSync, randomBytes } from 'node:crypto'

// Valeurs de démonstration ou d'exemple qui ne doivent jamais partir en production
export const DEMO_VALUES = [
  /^change-me/i,
  /^your-/i,
  /^noreply@yourdomain\.com$/i,
  /^Éditeur de démonstration/i,
  /^0{9}$/,
  /^0{14}$/,
]

const digits = (s) => String(s ?? '').replace(/\D/g, '')

export function luhn(num) {
  if (!/^\d+$/.test(num)) return false
  let sum = 0
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function validSiren(value) {
  const s = digits(value)
  return s.length === 9 && s !== '000000000' && luhn(s)
}

export function validUrl(value, { https = false } = {}) {
  try {
    const u = new URL(value)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    return !https || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const isLocalUrl = (value) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(String(value))

export const isDemoValue = (value) => DEMO_VALUES.some((re) => re.test(String(value ?? '').trim()))

// Secrets : JWT (64 octets), clé de chiffrement (32 octets hex), code vendeur
export function generateSecrets() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return {
    JWT_SECRET: randomBytes(48).toString('base64url'),
    JWT_REFRESH_SECRET: randomBytes(48).toString('base64url'),
    SECRETS_KEY: randomBytes(32).toString('hex'),
    PIN_SECRET: randomBytes(32).toString('base64url'),
    // PEM PKCS8 sur une ligne, \n échappés : format lu par SigningKeyService
    FISCAL_SIGNING_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim().replace(/\n/g, '\\n'),
  }
}

// Valeur d'un fichier .env : entre guillemets, guillemets et antislashs échappés
export function envValue(v) {
  const s = String(v ?? '')
  if (s === '') return ''
  if (/^[A-Za-z0-9_.:/@+-]+$/.test(s)) return s
  return `"${s.replace(/\\(?!n)/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function serializeEnv(entries, header = []) {
  const lines = header.map((h) => `# ${h}`)
  for (const [k, v] of entries) {
    if (k.startsWith('#')) lines.push('', k)
    else lines.push(`${k}=${envValue(v)}`)
  }
  return lines.join('\n') + '\n'
}

export function parseEnv(text) {
  const out = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    let v = line.slice(i + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    out[line.slice(0, i).trim()] = v
  }
  return out
}

const REQUIRED_API = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'SECRETS_KEY', 'FRONTEND_URL', 'EDITOR_COMPANY', 'EDITOR_SIREN', 'EDITOR_ADDRESS', 'EDITOR_REPRESENTATIVE', 'EDITOR_CITY', 'FISCAL_SIGNING_KEY']

// Contrôle d'un .env de production : liste des problèmes (vide si tout va bien)
export function checkApiEnv(env) {
  const problems = []
  for (const k of REQUIRED_API) if (!env[k]) problems.push(`${k} manquante`)
  for (const [k, v] of Object.entries(env)) if (v && isDemoValue(v)) problems.push(`${k} : valeur de démonstration (${String(v).slice(0, 30)})`)
  if (env.NODE_ENV !== 'production') problems.push('NODE_ENV doit valoir production')
  if (env.EDITOR_SIREN && !validSiren(env.EDITOR_SIREN)) problems.push('EDITOR_SIREN invalide (9 chiffres, clé de Luhn)')
  if (env.SECRETS_KEY && !/^[0-9a-f]{64}$/i.test(env.SECRETS_KEY)) problems.push('SECRETS_KEY : 64 caractères hexadécimaux attendus')
  for (const k of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) if (env[k] && env[k].length < 32) problems.push(`${k} trop court (32 caractères au moins)`)
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_SECRET et JWT_REFRESH_SECRET doivent différer')
  if (env.FRONTEND_URL && (!validUrl(env.FRONTEND_URL, { https: true }) || isLocalUrl(env.FRONTEND_URL))) problems.push('FRONTEND_URL : adresse publique en https attendue')
  if (env.FISCAL_SIGNING_KEY && !env.FISCAL_SIGNING_KEY.includes('BEGIN PRIVATE KEY')) problems.push('FISCAL_SIGNING_KEY : clé PEM PKCS8 attendue')
  if (!env.RESEND_API_KEY) problems.push('RESEND_API_KEY absente : aucun e-mail ne partira (tickets, factures, alertes)')
  return problems
}

export function checkWebEnv(env) {
  const problems = []
  for (const k of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_APP_URL']) {
    if (!env[k]) problems.push(`${k} manquante`)
    else if (!validUrl(env[k], { https: true }) || isLocalUrl(env[k])) problems.push(`${k} : adresse publique en https attendue`)
  }
  if (env.NEXT_PUBLIC_WS_URL && !env.NEXT_PUBLIC_WS_URL.startsWith('wss://')) problems.push('NEXT_PUBLIC_WS_URL : wss:// attendu en production')
  if (env.NEXT_PUBLIC_BRIDGE_URL && env.NEXT_PUBLIC_BRIDGE_URL.startsWith('ws://')) problems.push('NEXT_PUBLIC_BRIDGE_URL : wss:// conseillé (Safari refuse ws:// depuis une page https), voir docs/installation-production.md')
  return problems
}

// ── Serveur unique (deploy/.env.prod, deploy/docker-compose.prod.yml) ──────

// Nom de domaine seul : « caisse.boutique.fr », sans https:// ni chemin
export const validHostname = (v) => /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(String(v ?? ''))
const PLACEHOLDER_DOMAIN = /(^|\.)(exemple\.(fr|com)|example\.(com|org|net|fr)|yourdomain\.[a-z]+)$/i

// Clé publique age (X25519, bech32) : « age1 » suivi de 58 caractères
export const validAgeRecipient = (v) => /^age1[02-9ac-hj-np-z]{58}$/.test(String(v ?? ''))

// Mot de passe de la base : il entre dans une adresse postgresql://, donc hexadécimal
export const generateDbPassword = () => randomBytes(24).toString('hex')

// Adresses internes au réseau des conteneurs
export function dockerUrls(env) {
  return {
    databaseUrl: `postgresql://${env.POSTGRES_USER || 'flow'}:${env.POSTGRES_PASSWORD}@postgres:5432/${env.POSTGRES_DB || 'flow'}`,
    redisUrl: 'redis://redis:6379',
    appUrl: `https://${env.APP_DOMAIN}`,
    apiUrl: `https://${env.API_DOMAIN}`,
  }
}

// Problèmes qui n'empêchent pas de démarrer (simple avertissement)
export const isWarning = (problem) => /^(RESEND_API_KEY|NEXT_PUBLIC_BRIDGE_URL|Alertes)/.test(problem)

export function checkDeployEnv(env) {
  const problems = []
  for (const k of ['APP_DOMAIN', 'API_DOMAIN']) {
    const v = env[k]
    if (!v) problems.push(`${k} manquante`)
    else if (!validHostname(v)) problems.push(`${k} : nom de domaine seul attendu, sans https:// ni chemin (${v})`)
    else if (PLACEHOLDER_DOMAIN.test(v)) problems.push(`${k} : domaine d'exemple (${v})`)
  }
  if (env.APP_DOMAIN && env.APP_DOMAIN === env.API_DOMAIN) problems.push('APP_DOMAIN et API_DOMAIN doivent différer')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.ACME_EMAIL ?? '')) problems.push('ACME_EMAIL : adresse e-mail attendue (avis de Let’s Encrypt)')
  for (const k of ['POSTGRES_USER', 'POSTGRES_DB']) if (env[k] && !/^[a-z_][a-z0-9_]{0,62}$/.test(env[k])) problems.push(`${k} : minuscules, chiffres et _ seulement`)
  const pw = env.POSTGRES_PASSWORD ?? ''
  if (!pw) problems.push('POSTGRES_PASSWORD manquante (./deploy/flow configurer en génère un)')
  else if (pw.length < 24 || !/^[A-Za-z0-9_-]+$/.test(pw) || isDemoValue(pw)) problems.push('POSTGRES_PASSWORD : 24 caractères au moins, lettres, chiffres, - et _ seulement')

  const recipients = String(env.BACKUP_AGE_RECIPIENT ?? '').split(/[\s,]+/).filter(Boolean)
  if (!recipients.length) problems.push('BACKUP_AGE_RECIPIENT manquante : clé publique age (age1…), sans elle aucune sauvegarde')
  for (const r of recipients) {
    if (/^AGE-SECRET-KEY-/i.test(r)) problems.push('BACKUP_AGE_RECIPIENT : c’est une clé PRIVÉE, elle ne doit jamais être sur le serveur ; mettre la clé publique (age1…)')
    else if (!validAgeRecipient(r)) problems.push(`BACKUP_AGE_RECIPIENT : clé publique age attendue (age1…), reçu ${r.slice(0, 12)}…`)
  }
  if (!env.BACKUP_S3_ENDPOINT) problems.push('BACKUP_S3_ENDPOINT manquante (stockage des sauvegardes hors du serveur)')
  else if (!validUrl(env.BACKUP_S3_ENDPOINT, { https: true })) problems.push('BACKUP_S3_ENDPOINT : adresse https attendue')
  for (const k of ['BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY']) if (!env[k]) problems.push(`${k} manquante`)
  for (const k of ['BACKUP_KEEP_DAILY', 'BACKUP_KEEP_MONTHLY', 'BACKUP_KEEP_YEARLY', 'BACKUP_MAX_AGE_HOURS']) {
    if (env[k] !== undefined && env[k] !== '' && !(/^\d+$/.test(env[k]) && Number(env[k]) >= 1)) problems.push(`${k} : nombre entier, 1 au moins`)
  }
  if (env.BACKUP_PING_URL && !validUrl(env.BACKUP_PING_URL, { https: true })) problems.push('BACKUP_PING_URL : adresse https attendue')
  const mail = !!(env.BACKUP_ALERT_EMAIL && env.BACKUP_ALERT_FROM && env.BACKUP_RESEND_API_KEY)
  if (env.BACKUP_ALERT_EMAIL && !mail) problems.push('BACKUP_ALERT_EMAIL : BACKUP_ALERT_FROM et BACKUP_RESEND_API_KEY sont aussi nécessaires')
  if (!env.BACKUP_PING_URL && !mail) problems.push('Alertes : ni BACKUP_PING_URL ni e-mail (BACKUP_ALERT_*), une sauvegarde en panne passerait inaperçue')
  return problems
}
