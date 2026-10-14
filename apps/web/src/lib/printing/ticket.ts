import { FISCAL_SOFTWARE } from '@erp/types'
import { buildSaleTicket as build, type SaleTicketInput } from '@erp/utils'

// Le modèle du ticket vit dans @erp/utils : le serveur produit le même reçu en PDF
export { layoutTicket, legalLines, money, rateLabel, SERVICE_NOTE_THRESHOLD, taxCodes } from '@erp/utils'
export type { SaleTicketInput, TicketLine, TicketModel } from '@erp/utils'

export function buildSaleTicket(i: Omit<SaleTicketInput, 'software'>) {
  return build({ ...i, software: `${FISCAL_SOFTWARE.name} ${FISCAL_SOFTWARE.version}` })
}
