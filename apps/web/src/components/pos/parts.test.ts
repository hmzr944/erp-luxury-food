import { describe, it, expect } from 'vitest'
import { splitEqually } from './PartsPayment'

describe('splitEqually', () => {
  it('répartit au centime près, le reste sur la première part', () => {
    expect(splitEqually(10000, 3)).toEqual([3334, 3333, 3333])
    expect(splitEqually(41000, 2)).toEqual([20500, 20500])
  })
  it('la somme des parts égale toujours le total', () => {
    for (const [total, n] of [[1, 3], [999, 7], [123457, 11]]) {
      expect(splitEqually(total, n).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})
