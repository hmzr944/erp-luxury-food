// Recherche d'entreprises françaises : API Recherche d'entreprises de l'État
// (https://recherche-entreprises.api.gouv.fr, données SIRENE de l'INSEE,
// gratuite et sans clé, limitée à quelques requêtes par seconde).

export interface Company {
  name: string
  siren: string
  siret: string | null
  vatNumber: string | null
  address: string | null
  zipCode: string | null
  city: string | null
  active: boolean
}

const digits = (s: string) => s.replace(/\D/g, '')

// Clé de Luhn : SIREN (9 chiffres) et SIRET (14 chiffres)
export function luhn(num: string): boolean {
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

// La Poste fait exception à Luhn pour ses établissements (SIREN 356000000)
export function validSiret(siret: string): boolean {
  const s = digits(siret)
  if (s.length !== 14) return false
  if (s.startsWith('356000000')) return [...s].reduce((a, c) => a + Number(c), 0) % 5 === 0
  return luhn(s)
}

export function validSiren(siren: string): boolean {
  const s = digits(siren)
  return s.length === 9 && luhn(s)
}

// TVA intracommunautaire française : FR + clé + SIREN, clé = (12 + 3 × (SIREN mod 97)) mod 97
export function frenchVatNumber(siren: string): string | null {
  const s = digits(siren)
  if (s.length !== 9) return null
  const key = (12 + 3 * (Number(s) % 97)) % 97
  return `FR${String(key).padStart(2, '0')}${s}`
}

interface ApiEtablissement {
  siret?: string
  adresse?: string
  code_postal?: string
  libelle_commune?: string
  numero_voie?: string | null
  indice_repetition?: string | null
  type_voie?: string | null
  libelle_voie?: string | null
  complement_adresse?: string | null
  etat_administratif?: string
}

interface ApiResult {
  siren?: string
  nom_complet?: string
  nom_raison_sociale?: string | null
  etat_administratif?: string
  siege?: ApiEtablissement
  matching_etablissements?: ApiEtablissement[]
}

const TYPES_VOIE: Record<string, string> = {
  AV: 'avenue', BD: 'boulevard', CHE: 'chemin', IMP: 'impasse', PL: 'place', QUAI: 'quai', RTE: 'route', ALL: 'allée', CRS: 'cours', SQ: 'square', PAS: 'passage', FG: 'faubourg',
}

// « DES DEUX GARES » → « des Deux Gares » : articles en minuscules
const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'aux', 'au', 'sur', 'en'])
function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^(d'|l')?(\p{L})/u, (_m, p: string | undefined, c: string) => (p ?? '') + c.toUpperCase())))
    .join('')
}

// Rue seule (« 12 rue de la Paix ») : le code postal et la ville ont leurs champs
function street(e: ApiEtablissement): string | null {
  if (e.libelle_voie) {
    const type = e.type_voie ? (TYPES_VOIE[e.type_voie] ?? e.type_voie.toLowerCase()) : ''
    const parts = [e.complement_adresse, [e.numero_voie, e.indice_repetition].filter(Boolean).join(' '), type, titleCase(e.libelle_voie)]
    return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null
  }
  // Adresse complète seulement : on retire « code postal ville » en fin
  if (e.adresse) return e.adresse.replace(new RegExp(`\\s*${e.code_postal ?? '\\d{5}'}\\s+.*$`), '').trim() || e.adresse
  return null
}

export function mapCompanies(payload: unknown, query: string): Company[] {
  const results = (payload as { results?: ApiResult[] })?.results ?? []
  const wanted = digits(query).length === 14 ? digits(query) : null
  return results
    .filter((r) => r.siren)
    .map((r) => {
      // Recherche par SIRET : l'établissement cherché, sinon le siège
      const etab = (wanted && r.matching_etablissements?.find((e) => e.siret === wanted)) || r.siege || {}
      return {
        name: r.nom_raison_sociale || r.nom_complet || '',
        siren: r.siren!,
        siret: etab.siret ?? null,
        vatNumber: frenchVatNumber(r.siren!),
        address: street(etab),
        zipCode: etab.code_postal ?? null,
        city: etab.libelle_commune ? titleCase(etab.libelle_commune) : null,
        active: (etab.etat_administratif ?? r.etat_administratif) !== 'F' && r.etat_administratif !== 'C',
      }
    })
    .filter((c) => c.name)
}
