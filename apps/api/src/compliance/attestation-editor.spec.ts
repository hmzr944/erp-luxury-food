import { describe, expect, it } from 'vitest'
import { editorDeclarant, editorFromEnv } from './attestation.service'

const base = { EDITOR_COMPANY: 'Jeanne MARTIN', EDITOR_SIREN: '123 456 789', EDITOR_ADDRESS: '1 rue de la Paix, 75002 Paris', EDITOR_REPRESENTATIVE: 'MARTIN Jeanne', EDITOR_CITY: 'Paris' }

describe('identité de l’éditeur sur l’attestation', () => {
  it('société : représentant légal', () => {
    const e = editorFromEnv({ ...base, EDITOR_STATUS: 'SAS' })!
    expect(e.individual).toBe(false)
    expect(editorDeclarant(e)).toBe('MARTIN Jeanne, représentant légal de la société Jeanne MARTIN (SIREN 123456789)')
  })

  it('entrepreneur individuel : ni société ni représentant légal', () => {
    for (const status of ['entrepreneur individuel', 'EI', 'micro-entreprise']) {
      const e = editorFromEnv({ ...base, EDITOR_STATUS: status })!
      expect(e.individual).toBe(true)
      expect(editorDeclarant(e)).toBe('MARTIN Jeanne, entrepreneur individuel (EI) exerçant sous la dénomination Jeanne MARTIN (SIREN 123456789)')
    }
  })

  it('identité incomplète : pas d’attestation', () => {
    expect(editorFromEnv({ ...base, EDITOR_CITY: '' })).toBeNull()
  })
})
