import { sitesApi } from '@/lib/api/sites'

// Une plateforme, trois espaces : le vendeur arrive sur la caisse, l'atelier
// sur l'écran de production, le gérant sur le back-office (et passe de l'un
// à l'autre en un geste).
export type AppRole = 'OWNER' | 'MANAGER' | 'SELLER' | 'PRODUCTION'
export type Workspace = 'backoffice' | 'pos' | 'atelier'

export const WORKSPACE_ROLES: Record<Workspace, AppRole[]> = {
  backoffice: ['OWNER', 'MANAGER'],
  pos: ['OWNER', 'MANAGER', 'SELLER'],
  atelier: ['OWNER', 'MANAGER', 'PRODUCTION'],
}

export const ROLE_LABEL: Record<AppRole, string> = {
  OWNER: 'Titulaire',
  MANAGER: 'Gérant',
  SELLER: 'Vendeur',
  PRODUCTION: 'Atelier',
}

export async function homePath(role: AppRole | undefined, preferredSiteId?: string): Promise<string> {
  if (role !== 'SELLER' && role !== 'PRODUCTION') return '/dashboard'
  const sites = await sitesApi.getAll().catch(() => [])
  const wanted = role === 'PRODUCTION' ? sites.filter((s) => s.isSupplier) : sites.filter((s) => !s.isSupplier)
  const site = wanted.find((s) => s.id === preferredSiteId) ?? wanted[0] ?? sites[0]
  if (!site) return '/login?aucun-site=1'
  return role === 'PRODUCTION' ? `/atelier/${site.id}` : `/pos/${site.id}`
}
