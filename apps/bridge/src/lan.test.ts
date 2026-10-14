import { describe, expect, it } from 'vitest'
import { isLanHostSyntax, isPrivateIPv4, resolveLanHost } from './lan.js'

describe('adresses du réseau local', () => {
  it('reconnaît les plages privées', () => {
    for (const ip of ['192.168.1.50', '10.0.0.1', '172.16.0.1', '172.31.255.255', '127.0.0.1', '169.254.10.2']) {
      expect(isPrivateIPv4(ip)).toBe(true)
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '100.64.0.1', '192.169.0.1', '0.0.0.0', '255.255.255.255']) {
      expect(isPrivateIPv4(ip)).toBe(false)
    }
  })

  it('accepte localhost et les noms .local, refuse les autres noms', () => {
    expect(isLanHostSyntax('localhost')).toBe(true)
    expect(isLanHostSyntax('epson-tm-m30.local')).toBe(true)
    expect(isLanHostSyntax('example.com')).toBe(false)
    expect(isLanHostSyntax('evil.local.example.com')).toBe(false)
    expect(isLanHostSyntax('::1')).toBe(false)
  })

  it('refuse une IP publique avec un message français', async () => {
    await expect(resolveLanHost('8.8.8.8')).rejects.toMatchObject({ code: 'host_not_allowed' })
  })
})
