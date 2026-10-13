import { webcrypto } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ECDSA_PARAMS, RECEIPT_GENESIS_HASH } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class TerminalsService {
  constructor(private prisma: PrismaService) {}

  async register(siteId: string, data: { name: string; publicKey: webcrypto.JsonWebKey }, userId?: string) {
    // Refuse tout ce qui n'est pas une clé publique ECDSA P-256 valide
    const jwk = data.publicKey
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || 'd' in jwk) {
      throw new BadRequestException('Clé publique ECDSA P-256 attendue')
    }
    try {
      await webcrypto.subtle.importKey('jwk', jwk, ECDSA_PARAMS, true, ['verify'])
    } catch {
      throw new BadRequestException('Clé publique illisible')
    }
    const publicKey = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })
    return this.prisma.terminal.create({
      data: { siteId, name: data.name, publicKey, createdBy: userId },
      select: { id: true, name: true, siteId: true, createdAt: true },
    })
  }

  findBySite(siteId: string) {
    return this.prisma.terminal.findMany({
      where: { siteId },
      select: {
        id: true, name: true, isActive: true, createdAt: true, lastSeenAt: true,
        _count: { select: { receipts: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async deactivate(siteId: string, id: string) {
    const t = await this.prisma.terminal.findFirst({ where: { id, siteId } })
    if (!t) throw new NotFoundException('Caisse introuvable')
    return this.prisma.terminal.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } })
  }

  // Contrôle d'intégrité de la chaîne d'une caisse : compteurs continus,
  // chaque ticket pointe sur le précédent
  async verifyChain(siteId: string, id: string) {
    const t = await this.prisma.terminal.findFirst({ where: { id, siteId }, select: { id: true } })
    if (!t) throw new NotFoundException('Caisse introuvable')
    const receipts = await this.prisma.receiptChain.findMany({
      where: { terminalId: id },
      orderBy: { terminalCounter: 'asc' },
      select: { terminalCounter: true, terminalHash: true, terminalPreviousHash: true },
    })
    const errors: string[] = []
    let previous = RECEIPT_GENESIS_HASH
    receipts.forEach((r, i) => {
      if (r.terminalCounter !== i + 1) errors.push(`Ticket manquant avant le n° ${r.terminalCounter}`)
      if (r.terminalPreviousHash !== previous) errors.push(`Chaîne rompue au ticket n° ${r.terminalCounter}`)
      previous = r.terminalHash ?? ''
    })
    return { valid: errors.length === 0, checked: receipts.length, errors }
  }
}
