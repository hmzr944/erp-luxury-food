import { describe, expect, it } from 'vitest'
import { ariaSort, networkQueryString, nextSort } from './network'

describe('tri du stock du réseau', () => {
  it('un clic sur la colonne active inverse l\'ordre', () => {
    expect(nextSort({ sort: 'name', order: 'asc' }, 'name')).toEqual({ sort: 'name', order: 'desc' })
  })
  it('une autre colonne démarre par son ordre naturel', () => {
    expect(nextSort({ sort: 'name', order: 'asc' }, 'total')).toEqual({ sort: 'total', order: 'desc' })
    expect(nextSort({ sort: 'total', order: 'desc' }, 'name')).toEqual({ sort: 'name', order: 'asc' })
  })
  it('aria-sort dit l\'état de chaque colonne', () => {
    const s = { sort: 'total', order: 'desc' } as const
    expect(ariaSort(s, 'total')).toBe('descending')
    expect(ariaSort(s, 'name')).toBe('none')
    expect(ariaSort({ sort: 'name', order: 'asc' }, 'name')).toBe('ascending')
  })
})

describe('requête', () => {
  it('n\'envoie que les filtres posés', () => {
    const qs = new URLSearchParams(networkQueryString({ q: ' café ', siteIds: ['a', 'b'], lowOnly: true, sort: 'low', order: 'desc', page: 2 }))
    expect(qs.get('q')).toBe('café')
    expect(qs.get('siteIds')).toBe('a,b')
    expect(qs.get('low')).toBe('1')
    expect(qs.get('page')).toBe('2')
    const bare = new URLSearchParams(networkQueryString({ q: '', siteIds: [], lowOnly: false, sort: 'name', order: 'asc', page: 1 }))
    expect(bare.has('q') || bare.has('siteIds') || bare.has('low')).toBe(false)
  })
})
