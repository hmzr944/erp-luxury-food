import { describe, it, expect } from 'vitest'
import { lookupBarcode } from './lookup'

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('lookupBarcode', () => {
  it('prend le nom français et la première marque', async () => {
    const r = await lookupBarcode('3017620422003', () =>
      reply(200, { status: 1, product: { product_name_fr: 'Pâte à tartiner', product_name: 'Spread', brands: 'Marque A, Groupe B', quantity: '400 g' } }),
    )
    expect(r).toEqual({ barcode: '3017620422003', name: 'Pâte à tartiner', brand: 'Marque A', quantity: '400 g', imageUrl: undefined, source: 'Open Food Facts' })
  })

  it('passe à la base suivante si le produit est inconnu', async () => {
    const urls: string[] = []
    const r = await lookupBarcode('3600523307302', (url) => {
      urls.push(url)
      return url.includes('openbeautyfacts') ? reply(200, { status: 1, product: { product_name: 'Crème' } }) : reply(404, {})
    })
    expect(r?.source).toBe('Open Beauty Facts')
    expect(urls).toHaveLength(2)
  })

  it('ignore les codes qui ne sont pas des codes-barres et les pannes réseau', async () => {
    expect(await lookupBarcode('ABC', () => reply(200, {}))).toBeNull()
    expect(await lookupBarcode('12345678', () => Promise.reject(new Error('réseau')))).toBeNull()
  })
})
