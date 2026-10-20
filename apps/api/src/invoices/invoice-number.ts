// Numéro de facture : un compteur par organisation et par année civile, sans trou ni doublon, attribué dans la transaction qui enregistre la facture ; format FA-AAAA-NNNN, remis à zéro chaque 1er janvier (continuité et remise à zéro annuelle à valider par l'expert-comptable, voir docs/legal/pages-a-valider.md).
export type InvoiceNumberTx = {
  invoiceSequence: {
    createMany: (args: { data: { organizationId: string; year: number; lastNumber: number; prefix: string }[]; skipDuplicates: boolean }) => Promise<unknown>
    update: (args: { where: { organizationId_year: { organizationId: string; year: number } }; data: { lastNumber: { increment: number } } }) => Promise<{ lastNumber: number; prefix: string }>
  }
}

export function formatInvoiceNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`
}

// À appeler uniquement DANS une transaction : si elle échoue, l'incrément est annulé avec elle (pas de trou).
// La création est ignorée si la ligne existe déjà (pas d'erreur de doublon sous concurrence), puis l'incrément verrouille la ligne jusqu'à la fin de la transaction.
export async function nextInvoiceNumber(tx: InvoiceNumberTx, organizationId: string, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear()
  await tx.invoiceSequence.createMany({ data: [{ organizationId, year, lastNumber: 0, prefix: 'FA' }], skipDuplicates: true })
  const seq = await tx.invoiceSequence.update({
    where: { organizationId_year: { organizationId, year } },
    data: { lastNumber: { increment: 1 } },
  })
  return formatInvoiceNumber(seq.prefix, year, seq.lastNumber)
}
