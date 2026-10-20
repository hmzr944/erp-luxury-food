import { describe, it, expect, afterEach, vi } from 'vitest'
import { requestPersistentStorage, classifyStorageError, isNearlyFull } from './storage'

afterEach(() => vi.unstubAllGlobals())

function stubNavigator(storage: unknown) {
  vi.stubGlobal('navigator', { storage })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
}

describe('stockage persistant', () => {
  it('demande la persistance et lit le quota', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubNavigator({ persisted: async () => false, persist, estimate: async () => ({ usage: 10, quota: 100 }) })
    expect(await requestPersistentStorage()).toEqual({ persisted: true, usage: 10, quota: 100 })
    expect(persist).toHaveBeenCalledOnce()
  })

  it('persist refusé : état false, sans erreur', async () => {
    stubNavigator({ persisted: async () => false, persist: async () => false, estimate: async () => ({ usage: 1, quota: 2 }) })
    expect((await requestPersistentStorage()).persisted).toBe(false)
  })

  it('déjà persistant : ne redemande pas', async () => {
    const persist = vi.fn()
    stubNavigator({ persisted: async () => true, persist })
    expect((await requestPersistentStorage()).persisted).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it("tolère l'absence d'API (Safari, navigation privée)", async () => {
    stubNavigator(undefined)
    expect(await requestPersistentStorage()).toEqual({ persisted: null, usage: null, quota: null })
  })

  it('tolère une API qui lève', async () => {
    stubNavigator({ persisted: async () => { throw new Error('non') }, persist: async () => { throw new Error('non') }, estimate: async () => { throw new Error('non') } })
    expect(await requestPersistentStorage()).toEqual({ persisted: null, usage: null, quota: null })
  })

  it('classe les erreurs et repère un stockage presque plein', () => {
    expect(classifyStorageError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toBe('quota')
    expect(classifyStorageError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe('quota')
    expect(classifyStorageError({ name: 'DatabaseClosedError' })).toBe('closed')
    expect(classifyStorageError(new Error('autre'))).toBe('other')
    expect(isNearlyFull({ usage: 90, quota: 100 })).toBe(true)
    expect(isNearlyFull({ usage: 10, quota: 100 })).toBe(false)
    expect(isNearlyFull({ usage: null, quota: null })).toBe(false)
  })
})
