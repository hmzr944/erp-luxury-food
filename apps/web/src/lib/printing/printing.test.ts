import { describe, expect, it } from 'vitest'
import { buildSaleTicket, layoutTicket, taxCodes } from './ticket'
import { DRAWER_KICK, encodePc858, encodeTicket } from './escpos'
import { eposDocument } from './epos'

const receipt = { legalName: 'Maison Test', siret: '12345678900012', vatNumber: 'FR12123456789', legalForm: 'SAS', rcs: null, address: '1 rue du Four, 75006 Paris', policy: 'ASK' as const, serviceNote: true, footer: 'Échange sous 30 jours' }

const sale = (over: Partial<Parameters<typeof buildSaleTicket>[0]> = {}) =>
  buildSaleTicket({
    receipt,
    siteName: 'Boutique Opéra',
    terminalName: 'Caisse 1',
    number: '42',
    signedAt: new Date('2026-10-14T10:05:00Z'),
    lines: [
      { quantity: 2, name: 'Éclair café', unit: 6.5, total: 13, taxRate: 5.5 },
      { quantity: 1, name: 'Thé glacé', unit: 4, total: 4, taxRate: 10 },
    ],
    total: 17,
    taxBreakdown: [
      { rate: 5.5, ht: 12.32, tax: 0.68 },
      { rate: 10, ht: 3.64, tax: 0.36 },
    ],
    payments: [{ label: 'Espèces', amount: 20 }],
    change: 3,
    signature: 'a1b2c3d4',
    ...over,
  })

describe('Ticket de caisse', () => {
  it('lettres de TVA du taux le plus bas au plus haut', () => {
    expect([...taxCodes([20, 5.5, 10]).entries()]).toEqual([[5.5, 'A'], [10, 'B'], [20, 'C']])
  })

  it('porte les mentions légales, la TVA par taux, le rendu et le logiciel', () => {
    const text = layoutTicket(sale(), 48).map((l) => l.text).join('\n')
    expect(text).toContain('SIRET 12345678900012')
    expect(text).toContain('TVA FR12123456789')
    expect(text).toMatch(/A 5,5 %\s+12,32\s+0,68\s+13,00/)
    expect(text).toMatch(/Rendu\s+3,00/)
    expect(text).toMatch(/FLŌW \d+\.\d+\.\d+/)
    expect(layoutTicket(sale(), 48).every((l) => l.text.length <= 48)).toBe(true)
    expect(layoutTicket(sale(), 32).every((l) => l.text.length <= 32)).toBe(true)
  })

  it('note de service à partir de 25 € et double marqué', () => {
    expect(sale().title).toBe('TICKET')
    const note = sale({ total: 30, copy: 'DOUBLE' })
    expect(note.title).toBe('NOTE')
    expect(note.marks).toContain('DOUBLE CONSERVÉ PAR LE COMMERÇANT')
  })

  it('duplicata et mode formation sont marqués, sans signature en formation', () => {
    expect(sale({ duplicate: 2 }).marks).toContain('DUPLICATA N° 2')
    const fake = sale({ training: { operator: 'Léa Martin' } })
    expect(fake.marks).toEqual(['MODE FORMATION', 'TICKET FICTIF SANS VALEUR'])
    expect(fake.signature).toBeUndefined()
    expect(fake.meta).toContainEqual(['Opérateur', 'Léa Martin'])
  })
})

describe('ESC/POS', () => {
  it('accents et euro en PC858', () => {
    expect(encodePc858('é€à°')).toEqual([0x82, 0xd5, 0x85, 0xf8])
    expect(encodePc858('FLŌW’s')).toEqual([...'FLOW\'s'].map((c) => c.charCodeAt(0)))
  })

  it('initialise, choisit la page PC858, ouvre le tiroir et coupe', () => {
    const bytes = [...encodeTicket(sale(), { openDrawer: true })]
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 19])
    expect(bytes.slice(5, 10)).toEqual(DRAWER_KICK(0))
    expect(bytes.slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x00])
    expect(encodeTicket(sale(), { openDrawer: false }).includes(0x70)).toBe(true) // « p » de texte possible
  })
})

describe('Ticket dématérialisé', () => {
  it('imprime le QR code du reçu en ligne (GS ( k), sauf en formation', () => {
    const url = 'https://flow.example/r/55041315-c62b-45d6-8c73-29ec91f731a5'
    const bytes = [...encodeTicket(sale({ receiptUrl: url }))]
    const store = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 2] === 0x6b && bytes[i + 6] === 0x50)
    expect(store).toBeGreaterThan(0)
    expect(bytes[store + 3] + (bytes[store + 4] << 8)).toBe(url.length + 3)
    expect(new TextDecoder().decode(new Uint8Array(bytes.slice(store + 8, store + 8 + url.length)))).toBe(url)
    expect(sale({ receiptUrl: url, training: { operator: 'Léa' } }).qr).toBeUndefined()
    expect(eposDocument(sale({ receiptUrl: url }))).toContain('qrcode_model_2')
  })

  it('les paiements carte portent la référence du TPE', () => {
    const lines = layoutTicket(sale({ payments: [{ label: 'Carte', amount: 17, reference: 'STR-982341' }] }), 48).map((l) => l.text)
    expect(lines).toContain('   Réf. STR-982341')
  })
})

describe('Epson ePOS', () => {
  it('enveloppe SOAP, texte échappé, impulsion tiroir', () => {
    const doc = eposDocument(sale({ siteName: 'A & B <test>' }), { openDrawer: true })
    expect(doc).toContain('<s:Envelope')
    expect(doc).toContain('A &amp; B &lt;test&gt;')
    expect(doc).toContain('<pulse drawer="drawer_1" time="pulse_100"/>')
    expect(doc).toContain('<cut type="feed"/>')
  })
})
