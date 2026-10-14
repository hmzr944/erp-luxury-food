import { describe, expect, it } from 'vitest'
import { frenchVatNumber, mapCompanies, validSiren, validSiret } from './companies'

describe('Annuaire des entreprises', () => {
  it('contrôle SIREN et SIRET (clé de Luhn)', () => {
    expect(validSiren('732829320')).toBe(true)
    expect(validSiren('732829321')).toBe(false)
    expect(validSiret('73282932000074')).toBe(true)
    expect(validSiret('73282932000075')).toBe(false)
  })

  it('calcule le numéro de TVA intracommunautaire', () => {
    expect(frenchVatNumber('404833048')).toBe('FR83404833048')
    expect(frenchVatNumber('12')).toBeNull()
  })

  it('lit une réponse de l’annuaire et garde l’établissement cherché', () => {
    const payload = {
      results: [
        {
          siren: '552032534',
          nom_complet: 'DANONE (DANONE)',
          nom_raison_sociale: 'DANONE',
          etat_administratif: 'A',
          siege: { siret: '55203253400646', numero_voie: '17', type_voie: 'BD', libelle_voie: 'HAUSSMANN', code_postal: '75009', libelle_commune: 'PARIS', etat_administratif: 'A' },
          matching_etablissements: [{ siret: '55203253400687', adresse: '3 RUE SAARINEN 94150 RUNGIS', code_postal: '94150', libelle_commune: 'RUNGIS', etat_administratif: 'A' }],
        },
      ],
    }
    const [siege] = mapCompanies(payload, 'danone')
    expect(siege).toMatchObject({ name: 'DANONE', siren: '552032534', siret: '55203253400646', address: '17 boulevard Haussmann', zipCode: '75009', city: 'PARIS', active: true })
    expect(siege.vatNumber).toBe(frenchVatNumber('552032534'))
    const [etab] = mapCompanies(payload, '552 032 534 00687')
    expect(etab).toMatchObject({ siret: '55203253400687', address: '3 RUE SAARINEN', city: 'RUNGIS' })
  })
})
