// Pages légales publiques : version des textes et identité de l'éditeur.
//
// L'identité n'est jamais écrite dans le code : elle vient des variables
// NEXT_PUBLIC_* (alignées sur EDITOR_* de l'API, qui signent l'attestation
// fiscale). Une valeur absente s'affiche « [à compléter] », jamais devinée.
// Les NEXT_PUBLIC_* sont lues à la compilation : chaque nom est écrit en entier.

// Version des CGU, CGV et de la politique de confidentialité, la même que
// celle enregistrée à l'inscription (User.termsVersion).
export const LEGAL_VERSION = '2026-10'
// Date affichée « Version du ... » : à mettre à jour à chaque nouvelle version.
export const LEGAL_VERSION_DATE = '2026-10-18'
// Textes non encore relus par un juriste : bandeau et repères « À valider ».
// Passer à false une fois la relecture faite (voir docs/legal/pages-a-valider.md).
export const LEGAL_DRAFT = true

export const TO_COMPLETE = '[à compléter]'

export interface LegalEditor {
  company?: string
  status?: string
  capital?: string
  siren?: string
  registry?: string
  vatNumber?: string
  vatFranchise: boolean
  address?: string
  email?: string
  phone?: string
  representative?: string
  director?: string
  privacyEmail?: string
  dpo?: string
  court?: string
  /** Entrepreneur individuel (EI, micro-entreprise) : nom et domicile, pas de capital */
  individual: boolean
}

export interface LegalHost {
  name?: string
  address?: string
  phone?: string
}

type Env = Record<string, string | undefined>

const clean = (v: string | undefined) => {
  const t = v?.trim()
  return t ? t : undefined
}

const yes = (v: string | undefined) => /^(1|true|oui|yes|on)$/i.test(v?.trim() ?? '')

export function isIndividualStatus(status: string | undefined) {
  if (!status) return false
  return /entrepreneur individuel|micro[- ]?entrepr|auto[- ]?entrepr|^\s*EI\s*$/i.test(status)
}

export function readEditor(env: Env): LegalEditor {
  const status = clean(env.NEXT_PUBLIC_EDITOR_STATUS)
  return {
    company: clean(env.NEXT_PUBLIC_EDITOR_COMPANY),
    status,
    capital: clean(env.NEXT_PUBLIC_EDITOR_CAPITAL),
    siren: clean(env.NEXT_PUBLIC_EDITOR_SIREN)?.replace(/\s/g, '').replace(/(\d{3})(?=\d)/g, '$1 '),
    registry: clean(env.NEXT_PUBLIC_EDITOR_REGISTRY),
    vatNumber: clean(env.NEXT_PUBLIC_EDITOR_VAT_NUMBER),
    vatFranchise: yes(env.NEXT_PUBLIC_EDITOR_VAT_FRANCHISE),
    address: clean(env.NEXT_PUBLIC_EDITOR_ADDRESS),
    email: clean(env.NEXT_PUBLIC_EDITOR_EMAIL),
    phone: clean(env.NEXT_PUBLIC_EDITOR_PHONE),
    representative: clean(env.NEXT_PUBLIC_EDITOR_REPRESENTATIVE),
    director: clean(env.NEXT_PUBLIC_EDITOR_DIRECTOR),
    // Contact données personnelles : à défaut, l'adresse de contact générale
    privacyEmail: clean(env.NEXT_PUBLIC_EDITOR_PRIVACY_EMAIL) ?? clean(env.NEXT_PUBLIC_EDITOR_EMAIL),
    dpo: clean(env.NEXT_PUBLIC_EDITOR_DPO),
    court: clean(env.NEXT_PUBLIC_LEGAL_COURT),
    individual: isIndividualStatus(status),
  }
}

export function readHost(env: Env): LegalHost {
  return {
    name: clean(env.NEXT_PUBLIC_HOST_NAME),
    address: clean(env.NEXT_PUBLIC_HOST_ADDRESS),
    phone: clean(env.NEXT_PUBLIC_HOST_PHONE),
  }
}

// Lecture au build (noms écrits en entier pour que Next les remplace)
const publicEnv: Env = {
  NEXT_PUBLIC_EDITOR_COMPANY: process.env.NEXT_PUBLIC_EDITOR_COMPANY,
  NEXT_PUBLIC_EDITOR_STATUS: process.env.NEXT_PUBLIC_EDITOR_STATUS,
  NEXT_PUBLIC_EDITOR_CAPITAL: process.env.NEXT_PUBLIC_EDITOR_CAPITAL,
  NEXT_PUBLIC_EDITOR_SIREN: process.env.NEXT_PUBLIC_EDITOR_SIREN,
  NEXT_PUBLIC_EDITOR_REGISTRY: process.env.NEXT_PUBLIC_EDITOR_REGISTRY,
  NEXT_PUBLIC_EDITOR_VAT_NUMBER: process.env.NEXT_PUBLIC_EDITOR_VAT_NUMBER,
  NEXT_PUBLIC_EDITOR_VAT_FRANCHISE: process.env.NEXT_PUBLIC_EDITOR_VAT_FRANCHISE,
  NEXT_PUBLIC_EDITOR_ADDRESS: process.env.NEXT_PUBLIC_EDITOR_ADDRESS,
  NEXT_PUBLIC_EDITOR_EMAIL: process.env.NEXT_PUBLIC_EDITOR_EMAIL,
  NEXT_PUBLIC_EDITOR_PHONE: process.env.NEXT_PUBLIC_EDITOR_PHONE,
  NEXT_PUBLIC_EDITOR_REPRESENTATIVE: process.env.NEXT_PUBLIC_EDITOR_REPRESENTATIVE,
  NEXT_PUBLIC_EDITOR_DIRECTOR: process.env.NEXT_PUBLIC_EDITOR_DIRECTOR,
  NEXT_PUBLIC_EDITOR_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_EDITOR_PRIVACY_EMAIL,
  NEXT_PUBLIC_EDITOR_DPO: process.env.NEXT_PUBLIC_EDITOR_DPO,
  NEXT_PUBLIC_LEGAL_COURT: process.env.NEXT_PUBLIC_LEGAL_COURT,
  NEXT_PUBLIC_HOST_NAME: process.env.NEXT_PUBLIC_HOST_NAME,
  NEXT_PUBLIC_HOST_ADDRESS: process.env.NEXT_PUBLIC_HOST_ADDRESS,
  NEXT_PUBLIC_HOST_PHONE: process.env.NEXT_PUBLIC_HOST_PHONE,
}

export const EDITOR = readEditor(publicEnv)
export const HOST = readHost(publicEnv)

export function formatLegalDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(`${iso}T12:00:00Z`))
}

export const LEGAL_PAGES = [
  { slug: 'mentions-legales', href: '/legal/mentions-legales', label: 'Mentions légales' },
  { slug: 'cgu', href: '/legal/cgu', label: "Conditions générales d'utilisation" },
  { slug: 'cgv', href: '/legal/cgv', label: 'Conditions générales de vente' },
  { slug: 'confidentialite', href: '/legal/confidentialite', label: 'Politique de confidentialité' },
  { slug: 'conformite', href: '/legal/conformite', label: 'Conformité de la caisse' },
] as const

export type LegalSlug = (typeof LEGAL_PAGES)[number]['slug']
