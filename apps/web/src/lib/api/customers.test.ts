import { describe, expect, it } from 'vitest'
import { customerName, displayPhone } from './customers'

describe('displayPhone', () => {
  it('affiche un numéro français par paires', () => {
    expect(displayPhone('+33612345678')).toBe('06 12 34 56 78')
    expect(displayPhone('+4915112345678')).toBe('+4915112345678')
    expect(displayPhone(null)).toBeNull()
  })
  it('nomme le client par son numéro à défaut de nom', () => {
    expect(customerName({ firstName: null, lastName: null, phone: '+33612345678', email: null })).toBe('06 12 34 56 78')
  })
})
