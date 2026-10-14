import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { mapCompanies, type Company } from './companies'

const API = 'https://recherche-entreprises.api.gouv.fr/search'
const TTL = 10 * 60_000

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name)
  private cache = new Map<string, { at: number; companies: Company[] }>()

  async search(q: string): Promise<Company[]> {
    const query = q.trim().replace(/\s+/g, ' ')
    const compact = query.replace(/\s/g, '')
    const term = /^\d{9}$|^\d{14}$/.test(compact) ? compact : query
    if (term.length < 3) throw new BadRequestException('Saisissez au moins 3 caractères, ou un SIRET')

    const hit = this.cache.get(term.toLowerCase())
    if (hit && Date.now() - hit.at < TTL) return hit.companies

    const url = `${API}?${new URLSearchParams({ q: term, per_page: '8', page: '1'})}`
    let res: Response | null = null
    // Un second essai rattrape une coupure passagère
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      try {
        res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
      } catch (e) {
        this.logger.warn(`Recherche d'entreprises injoignable : ${(e as Error).message}`)
      }
    }
    if (!res) throw new ServiceUnavailableException('Annuaire des entreprises injoignable : saisissez les coordonnées à la main.')
    if (res.status === 429) throw new ServiceUnavailableException('Annuaire des entreprises très sollicité : réessayez dans un instant.')
    if (!res.ok) throw new ServiceUnavailableException('Annuaire des entreprises indisponible : saisissez les coordonnées à la main.')

    const companies = mapCompanies(await res.json(), term)
    this.cache.set(term.toLowerCase(), { at: Date.now(), companies })
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!)
    return companies
  }
}
