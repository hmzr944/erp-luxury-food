import { describe, expect, it } from 'vitest'
import { assertPublicUrl, isPrivateAddress } from './public-url'

describe('URL sortantes', () => {
  it('adresses internes reconnues', () => {
    for (const ip of ['127.0.0.1', '10.2.3.4', '172.20.0.1', '192.168.1.10', '169.254.169.254', '100.64.1.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '0.0.0.0']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '151.101.1.1', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false)
  })
  it('refuse http, localhost, métadonnées du cloud et identifiants', async () => {
    await expect(assertPublicUrl('http://example.com/hook')).rejects.toThrow('https')
    await expect(assertPublicUrl('https://localhost/x')).rejects.toThrow('interne')
    await expect(assertPublicUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow('interne')
    await expect(assertPublicUrl('https://[::1]/x')).rejects.toThrow('interne')
    await expect(assertPublicUrl('https://user:pw@8.8.8.8/x')).rejects.toThrow('Identifiants')
  })
  it('accepte une adresse publique', async () => {
    await expect(assertPublicUrl('https://8.8.8.8/hook')).resolves.toBeInstanceOf(URL)
  })
})
