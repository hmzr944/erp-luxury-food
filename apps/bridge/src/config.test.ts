import { describe, expect, it } from 'vitest'
import { loadConfig, parseAppUrl } from './config.js'

describe('adresse de la caisse (FLOW_APP_URL)', () => {
  it('garde l’origine et le chemin, sans barre finale ni paramètres', () => {
    expect(parseAppUrl('https://caisse.exemple.fr/')).toBe('https://caisse.exemple.fr')
    expect(parseAppUrl('https://exemple.fr/flow/?x=1#y')).toBe('https://exemple.fr/flow')
    expect(parseAppUrl(undefined)).toBeUndefined()
    expect(parseAppUrl('  ')).toBeUndefined()
  })

  it('refuse ce qui n’est pas une adresse http(s) sans identifiants', () => {
    expect(() => parseAppUrl('javascript:alert(1)')).toThrow(/FLOW_APP_URL invalide/)
    expect(() => parseAppUrl('https://moi:secret@exemple.fr')).toThrow(/FLOW_APP_URL invalide/)
    expect(() => parseAppUrl('pas une adresse')).toThrow(/FLOW_APP_URL invalide/)
  })

  it('la caisse désignée est autorisée en plus des origines déclarées', () => {
    const c = loadConfig({ FLOW_APP_URL: 'https://Caisse.Exemple.fr/', FLOW_BRIDGE_ORIGINS: 'http://localhost:3000', FLOW_BRIDGE_HOME: '/tmp/x' })
    expect(c.appUrl).toBe('https://caisse.exemple.fr')
    expect(c.origins).toEqual(['http://localhost:3000', 'https://caisse.exemple.fr'])
  })
})
