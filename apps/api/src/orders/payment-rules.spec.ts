import { describe, it, expect } from 'vitest'
import { checkPayments, mealVoucherAllowance } from '@erp/utils'

const methods = [
  { code: 'CASH', label: 'Espèces', kind: 'CASH' },
  { code: 'CARD', label: 'Carte', kind: 'CARD' },
  { code: 'TICKET_RESTO', label: 'Titre-restaurant', kind: 'VOUCHER', mealVoucher: true, maxAmount: '25' },
  { code: 'CHEQUE', label: 'Chèque', kind: 'OTHER', requiresReference: true },
]
const food = { total: 18, mealVoucherEligible: true }
const wine = { total: 30, mealVoucherEligible: false }

describe('Règles d’encaissement', () => {
  it('titre-restaurant : articles éligibles seulement, plafonné à 25 €', () => {
    expect(mealVoucherAllowance([food, wine], methods[2])).toBe(18)
    expect(mealVoucherAllowance([food, food], methods[2])).toBe(25)
    expect(mealVoucherAllowance([wine], methods[2])).toBe(0)
  })

  it('refuse un titre-restaurant au-delà de l’éligible ou du plafond', () => {
    expect(checkPayments({ lines: [food, wine], payments: [{ code: 'TICKET_RESTO', amount: 18 }, { code: 'CARD', amount: 30 }], methods })).toEqual([])
    expect(checkPayments({ lines: [food, wine], payments: [{ code: 'TICKET_RESTO', amount: 20 }, { code: 'CARD', amount: 28 }], methods })[0]).toMatch(/articles éligibles/)
    expect(checkPayments({ lines: [food, food], payments: [{ code: 'TICKET_RESTO', amount: 30 }, { code: 'CARD', amount: 6 }], methods })[0]).toMatch(/plafonné/)
    expect(checkPayments({ lines: [wine], payments: [{ code: 'TICKET_RESTO', amount: 5 }, { code: 'CARD', amount: 25 }], methods })[0]).toMatch(/Aucun article/)
  })

  it('demande le numéro du chèque', () => {
    expect(checkPayments({ lines: [wine], payments: [{ code: 'CHEQUE', amount: 30 }], methods })).toEqual(['Chèque : numéro à saisir'])
    expect(checkPayments({ lines: [wine], payments: [{ code: 'CHEQUE', amount: 30, reference: '0012345' }], methods })).toEqual([])
  })

  it('espèces : 1 000 € pour un résident, 15 000 € pour un non-résident', () => {
    const big = [{ total: 2000, mealVoucherEligible: false }]
    expect(checkPayments({ lines: big, payments: [{ code: 'CASH', amount: 1000 }, { code: 'CARD', amount: 1000 }], methods })).toEqual([])
    expect(checkPayments({ lines: big, payments: [{ code: 'CASH', amount: 2000 }], methods })[0]).toMatch(/résidant en France/)
    expect(checkPayments({ lines: big, payments: [{ code: 'CASH', amount: 2000 }], methods, nonResident: true })).toEqual([])
    expect(checkPayments({ lines: [{ total: 16000, mealVoucherEligible: false }], payments: [{ code: 'CASH', amount: 16000 }], methods, nonResident: true })[0]).toMatch(/non résident/)
  })
})

describe('Carte titre-restaurant passée sur le TPE', () => {
  const withCard = [
    ...methods,
    { code: 'TICKET_RESTO_CARD', label: 'Carte titre-restaurant', kind: 'OTHER', mealVoucher: true, maxAmount: '25' },
  ]

  it('accepte le paiement avec la référence de transaction du TPE, même plafond que le papier', () => {
    expect(
      checkPayments({ lines: [food, wine], payments: [{ code: 'TICKET_RESTO_CARD', amount: 18, reference: 'A12345' }, { code: 'CARD', amount: 30 }], methods: withCard }),
    ).toEqual([])
    expect(
      checkPayments({ lines: [food, food], payments: [{ code: 'TICKET_RESTO_CARD', amount: 30, reference: 'A12345' }, { code: 'CARD', amount: 6 }], methods: withCard })[0],
    ).toMatch(/plafonné/)
  })

  it('carte et papier ensemble ne dépassent pas le plafond', () => {
    const issues = checkPayments({
      lines: [food, food],
      payments: [{ code: 'TICKET_RESTO', amount: 15 }, { code: 'TICKET_RESTO_CARD', amount: 15, reference: 'A12345' }, { code: 'CARD', amount: 6 }],
      methods: withCard,
    })
    expect(issues[0]).toMatch(/plafonné/)
  })
})
