import { randomInt } from 'node:crypto'
import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// Code lisible, sans caractères ambigus (0/O, 1/I) : AV-7K3P-9QXM
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export function creditCode(): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  return `AV-${part()}-${part()}`
}

export const normalizeCreditCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

// Débite un avoir dans la transaction de la vente. Verrou sur l'avoir : deux
// caisses ne peuvent pas dépenser le même solde en même temps.
// strict : refuse un solde insuffisant (vente en ligne). Sinon (vente déjà
// signée hors ligne) on débite ce qui reste et on le signale.
export async function redeemCredit(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; code: string; amount: number; orderId: string; strict: boolean },
): Promise<{ shortfall: number }> {
  const code = normalizeCreditCode(input.code)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'avoir:' + code}))`
  const credit = await tx.storeCredit.findFirst({ where: { code, organizationId: input.organizationId } })
  if (!credit) {
    if (input.strict) throw new BadRequestException(`Avoir ${code} introuvable`)
    return { shortfall: input.amount }
  }
  if (credit.expiresAt && credit.expiresAt < new Date() && input.strict) throw new BadRequestException(`Avoir ${code} expiré`)
  const wanted = new Decimal(input.amount)
  const taken = Decimal.min(wanted, credit.balance)
  if (input.strict && taken.lt(wanted)) {
    throw new BadRequestException(`Avoir ${code} : il reste ${credit.balance.toFixed(2)} €`)
  }
  if (taken.gt(0)) {
    await tx.storeCredit.update({ where: { id: credit.id }, data: { balance: credit.balance.sub(taken) } })
    await tx.storeCreditRedemption.create({ data: { creditId: credit.id, orderId: input.orderId, amount: taken } })
  }
  return { shortfall: wanted.sub(taken).toNumber() }
}
