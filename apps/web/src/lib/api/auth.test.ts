import { describe, expect, it } from 'vitest'
import { passwordProblem } from './auth'

describe('passwordProblem', () => {
  it('demande 10 caractères et deux saisies identiques', () => {
    expect(passwordProblem('court', 'court')).toBe('Mot de passe : 10 caractères minimum')
    expect(passwordProblem('assez-long-1', 'assez-long-2')).toBe('Les deux mots de passe ne sont pas identiques')
    expect(passwordProblem('assez-long-1', 'assez-long-1')).toBeNull()
  })
})
