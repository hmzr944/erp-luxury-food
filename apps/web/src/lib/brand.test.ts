import { describe, expect, it } from 'vitest'
import { RAYON_SHAPES, rayonShapes } from './brand'

describe('rayonShapes', () => {
  it('donne une forme différente à chaque rayon tant qu’il en reste', () => {
    const cats = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, color: null }))
    const shapes = [...rayonShapes(cats).values()]
    expect(new Set(shapes).size).toBe(6)
  })

  it('garde la forme choisie et décale un doublon', () => {
    const map = rayonShapes([
      { id: 'a', color: 'anneau' },
      { id: 'b', color: 'anneau' },
      { id: 'c', color: '#ff0000' },
    ])
    expect(map.get('a')).toBe('anneau')
    expect(map.get('b')).not.toBe('anneau')
    expect(RAYON_SHAPES).toContain(map.get('c'))
  })
})
