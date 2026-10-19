import { FISCAL_SOFTWARE } from '@erp/types'
import { buildSaleTicket as build, type SaleTicketInput } from '@erp/utils'

// Le modèle du ticket vit dans @erp/utils : le serveur produit le même reçu en PDF
export { layoutTicket, legalLines, money, rateLabel, SERVICE_NOTE_THRESHOLD, taxCodes } from '@erp/utils'
export type { SaleTicketInput, TicketLine, TicketModel } from '@erp/utils'

export function buildSaleTicket(i: Omit<SaleTicketInput, 'software'>) {
  return build({ ...i, software: `${FISCAL_SOFTWARE.name} ${FISCAL_SOFTWARE.version}` })
}

// Ticket d'essai : fictif, marqué comme tel, avec les caractères accentués et
// l'euro pour vérifier l'encodage de l'imprimante
export function buildTestTicket(receipt?: SaleTicketInput['receipt']) {
  return buildSaleTicket({
    receipt,
    siteName: 'Ticket d’essai',
    terminalName: 'Cette caisse',
    number: 'ESSAI',
    signedAt: new Date(),
    lines: [{ quantity: 1, name: 'Article d’essai éèàç €', unit: 1, total: 1, taxRate: 20 }],
    total: 1,
    taxBreakdown: [{ rate: 20, ht: 0.83, tax: 0.17 }],
    payments: [{ label: 'Essai', amount: 1 }],
    training: { operator: 'Essai d’impression' },
  })
}
