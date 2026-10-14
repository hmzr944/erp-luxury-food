// Qui peut appeler quoi, selon le rôle. Une seule plateforme, des espaces
// métier : le vendeur encaisse et commande pour sa boutique, l'atelier
// produit et expédie, le gérant voit tout. Appliqué à chaque requête par
// WorkspaceInterceptor, en plus des contrôles propres à chaque route.

type Rule = { method?: string; path: RegExp }

const SITE = '/sites/[^/]+'

// Atelier (labo, cuisine centrale, dépôt) : uniquement la production
const PRODUCTION_ALLOW: Rule[] = [
  { path: /^\/auth\// },
  { method: 'GET', path: /^\/sites$/ },
  { method: 'GET', path: /^\/platform\/config$/ },
  { method: 'GET', path: /^\/billing$/ },
  { path: new RegExp(`^${SITE}/supply/production(/start)?$`) },
  { method: 'POST', path: new RegExp(`^${SITE}/supply/orders/[^/]+/ship$`) },
  { method: 'GET', path: new RegExp(`^${SITE}/supply/catalog$`) },
  { path: new RegExp(`^${SITE}/supply/alerts(/[^/]+)?$`) },
]

// Vendeur : la caisse et le réassort de sa boutique, sans chiffres globaux
// ni coûts du labo
const SELLER_DENY: Rule[] = [
  { path: /^\/dashboard/ },
  { path: new RegExp(`^${SITE}/dashboard`) },
  { path: new RegExp(`^${SITE}/data`) },
  { path: /^\/organizations\/me\/data/ },
  { path: /^\/invoices/ },
  { path: /^\/b2b/ },
  { path: new RegExp(`^${SITE}/b2b`) },
  // Conformité : le vendeur imprime ses duplicatas et ses tickets de
  // formation, mais ne voit ni les clôtures ni les archives (chiffres globaux)
  { path: new RegExp(`^${SITE}/compliance/(export|closures|archives|events|summary|verify)`) },
  { path: new RegExp(`^${SITE}/cash/(sessions|settings)`) },
  { path: new RegExp(`^${SITE}/routine/settings`) },
  { path: /^\/sites\/[^/]+\/printers/ },
  { path: /^\/organizations\/me\/(settings|audit|attestation)/ },
  { path: /^\/billing\/(checkout|portal)/ },
  { path: /^\/api-tokens/ },
  { path: /^\/webhooks/ },
  { path: new RegExp(`^${SITE}/supply/(production|statement|catalog)`) },
  { method: 'POST', path: new RegExp(`^${SITE}/supply/orders/[^/]+/ship$`) },
  { method: 'POST', path: new RegExp(`^${SITE}/supply/alerts$`) },
  { method: 'DELETE', path: new RegExp(`^${SITE}/supply/alerts/[^/]+$`) },
]

const matches = (rules: Rule[], method: string, path: string) =>
  rules.some((r) => (!r.method || r.method === method) && r.path.test(path))

export function isAllowed(role: string | undefined, method: string, rawPath: string): boolean {
  // Les routes Express ignorent la casse : /api/WEBHOOKS mène à /api/webhooks.
  // On compare donc en minuscules, après avoir retiré la requête et les // en trop
  const path =
    decodeURIComponent(rawPath.split('?')[0])
      .toLowerCase()
      .replace(/\/{2,}/g, '/')
      .replace(/^\/api/, '')
      .replace(/\/+$/, '') || '/'
  if (role === 'PRODUCTION') return matches(PRODUCTION_ALLOW, method, path)
  if (role === 'SELLER') return !matches(SELLER_DENY, method, path)
  return true
}
