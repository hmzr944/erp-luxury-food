import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ECDSA_PARAMS, RECEIPT_GENESIS_HASH } from '@erp/utils'

// Stockage du navigateur simulé (les tests tournent sous Node)
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})
vi.stubGlobal('window', globalThis)

const { db } = await import('@/lib/offline/db')
const { rememberOfflinePin } = await import('@/lib/terminal/offline-pin')
const { useAuthStore } = await import('./auth.store')
const { offlineSession, hasOfflineSession } = await import('@/lib/auth/offline-session')

const SITE = 'site-1'
const lea = { id: 'u-lea', email: 'lea@b.test', firstName: 'Léa', lastName: 'Martin', role: 'SELLER' as const, organizationId: 'org1' }
const paul = { id: 'u-paul', email: 'paul@b.test', firstName: 'Paul', lastName: 'Durand', role: 'MANAGER' as const, organizationId: 'org1' }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(async () => {
  store.clear()
  await db.config.clear()
  await db.terminals.clear()
  const keys = await crypto.subtle.generateKey(ECDSA_PARAMS, false, ['sign', 'verify'])
  await db.terminals.put({ siteId: SITE, terminalId: 'term-1', name: 'Caisse 1', privateKey: keys.privateKey, counter: 0, lastHash: RECEIPT_GENESIS_HASH })
  await rememberOfflinePin(SITE, 'term-1', '1234', lea, { terminalSalt: 'sc', salt: 'sl' })
  // Paul est connecté en ligne sur la caisse
  store.set('access_token', 'jeton-paul')
  store.set('refresh_token', 'refresh-paul')
  useAuthStore.setState({ user: paul, accessToken: 'jeton-paul', isAuthenticated: true })
})

describe('reprise de la caisse sans réseau', () => {
  it('serveur injoignable : Léa reprend, le jeton de Paul est retiré, rien de secret écrit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await useAuthStore.getState().pinLogin(SITE, '1234')).toEqual({ offline: true })
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u-lea', firstName: 'Léa', role: 'SELLER' })
    expect(store.get('access_token')).toBeUndefined()
    expect(store.get('refresh_token')).toBeUndefined()
    expect(offlineSession()).toMatchObject({ siteId: SITE, userId: 'u-lea' })
    expect([...store.values()].join()).not.toContain('1234')
  })

  it('code refusé par le serveur : jamais de repli hors ligne', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { message: 'Code inconnu' })))
    await expect(useAuthStore.getState().pinLogin(SITE, '1234')).rejects.toThrow('Code inconnu')
    expect(useAuthStore.getState().user?.id).toBe('u-paul')
    expect(store.get('access_token')).toBe('jeton-paul')
    expect(hasOfflineSession()).toBe(false)
  })

  it('code faux hors ligne : refusé, la session de Paul reste', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(useAuthStore.getState().pinLogin(SITE, '0000')).rejects.toThrow(/hors ligne/)
    expect(useAuthStore.getState().user?.id).toBe('u-paul')
    expect(store.get('access_token')).toBe('jeton-paul')
  })

  it('retour du réseau : reconnexion silencieuse avec l’heure de la reprise et la personne attendue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await useAuthStore.getState().pinLogin(SITE, '1234')
    const at = offlineSession()!.at
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(200, { accessToken: 'jeton-lea', refreshToken: 'refresh-lea', user: lea }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await useAuthStore.getState().reconfirmOffline(SITE)).toBe('confirmed')
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body).toMatchObject({ pin: '1234', offlineAt: at, offlineUserId: 'u-lea', terminalId: 'term-1' })
    expect(store.get('access_token')).toBe('jeton-lea')
    expect(hasOfflineSession()).toBe(false)
    expect(useAuthStore.getState().user?.email).toBe('lea@b.test')
  })

  it('retour du réseau mais code refusé : la caisse redemande le code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await useAuthStore.getState().pinLogin(SITE, '1234')
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { message: 'Ce code a changé' })))
    expect(await useAuthStore.getState().reconfirmOffline(SITE)).toBe('refused')
    expect(hasOfflineSession()).toBe(false)
    expect(store.get('access_token')).toBeUndefined()
  })

  it('toujours pas de réseau : on garde la session locale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await useAuthStore.getState().pinLogin(SITE, '1234')
    expect(await useAuthStore.getState().reconfirmOffline(SITE)).toBe('offline')
    expect(hasOfflineSession()).toBe(true)
  })
}, 30_000)
