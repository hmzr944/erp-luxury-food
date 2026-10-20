import { describe, expect, it } from 'vitest'
import { LEGAL_PAGES, formatLegalDate, isIndividualStatus, readEditor, readHost } from './legal'

describe('readEditor', () => {
  it('ne devine rien quand les variables manquent', () => {
    const e = readEditor({})
    expect(e.company).toBeUndefined()
    expect(e.siren).toBeUndefined()
    expect(e.director).toBeUndefined()
    expect(e.vatFranchise).toBe(false)
    expect(e.individual).toBe(false)
    expect(readHost({ NEXT_PUBLIC_HOST_NAME: '  ' }).name).toBeUndefined()
  })

  it('lit et met en forme les valeurs fournies', () => {
    const e = readEditor({
      NEXT_PUBLIC_EDITOR_COMPANY: ' Exemple ',
      NEXT_PUBLIC_EDITOR_SIREN: '123456789',
      NEXT_PUBLIC_EDITOR_EMAIL: 'contact@exemple.fr',
      NEXT_PUBLIC_EDITOR_VAT_FRANCHISE: 'oui',
    })
    expect(e.company).toBe('Exemple')
    expect(e.siren).toBe('123 456 789')
    expect(e.privacyEmail).toBe('contact@exemple.fr')
    expect(e.vatFranchise).toBe(true)
  })

  it('reconnaît un entrepreneur individuel', () => {
    expect(isIndividualStatus('entrepreneur individuel')).toBe(true)
    expect(isIndividualStatus('EI')).toBe(true)
    expect(isIndividualStatus('micro-entrepreneur')).toBe(true)
    expect(isIndividualStatus('SAS')).toBe(false)
    expect(isIndividualStatus(undefined)).toBe(false)
  })
})

describe('formatLegalDate', () => {
  it('écrit la date en français', () => {
    expect(formatLegalDate('2026-10-18')).toBe('18 octobre 2026')
  })
})

describe('LEGAL_PAGES', () => {
  it('liste la page de conformité, sans doublon', () => {
    expect(LEGAL_PAGES.some((p) => p.slug === 'conformite' && p.href === '/legal/conformite')).toBe(true)
    expect(new Set(LEGAL_PAGES.map((p) => p.href)).size).toBe(LEGAL_PAGES.length)
  })

  it('ne contient aucun tiret cadratin', () => {
    for (const p of LEGAL_PAGES) expect(p.label).not.toMatch(/[\u2014\u2013]/)
  })
})
