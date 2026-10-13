import { describe, it, expect } from 'vitest'
import { decryptSecret, encryptSecret, maskSecret } from './secrets'

describe('secrets', () => {
  it('chiffre et déchiffre', () => {
    const sealed = encryptSecret('sk_test_51abcdefghijklmnop')
    expect(sealed).not.toContain('sk_test')
    expect(decryptSecret(sealed)).toBe('sk_test_51abcdefghijklmnop')
  })

  it('produit un chiffré différent à chaque fois', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'))
  })

  it('détecte une altération', () => {
    const sealed = encryptSecret('secret')
    const parts = sealed.split('.')
    parts[3] = Buffer.from('autre').toString('base64url')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  it('masque une clé pour l\'affichage', () => {
    expect(maskSecret('sk_test_51abcdefghijklmnop')).toBe('sk_test_…mnop')
    expect(maskSecret('abc')).toBe('••••')
  })
})
