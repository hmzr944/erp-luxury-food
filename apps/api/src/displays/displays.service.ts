import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { createHash, randomBytes, randomInt } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'

const CODE_TTL_MS = 10 * 60_000

export const hashDisplayToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Écran client sur tablette : la tablette tire un jeton et affiche un code à
// 6 chiffres ; un vendeur saisit ce code sur sa caisse pour les relier
@Injectable()
export class DisplaysService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async create() {
    // Tablettes jamais reliées depuis un jour : oubliées
    await this.prisma.customerDisplay.deleteMany({ where: { siteId: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } })
    const token = randomBytes(24).toString('hex')
    const display = await this.prisma.customerDisplay.create({ data: { tokenHash: hashDisplayToken(token), ...(await this.freshCode()) } })
    return { token, code: display.pairCode, expiresAt: display.pairExpiresAt }
  }

  // État vu par la tablette ; un code expiré est remplacé
  async status(token: string) {
    const display = await this.byToken(token)
    if (display.siteId) {
      await this.prisma.customerDisplay.update({ where: { id: display.id }, data: { lastSeenAt: new Date() } })
      return { paired: true as const, siteName: display.site?.name ?? null }
    }
    if (!display.pairCode || !display.pairExpiresAt || display.pairExpiresAt < new Date()) {
      const updated = await this.prisma.customerDisplay.update({ where: { id: display.id }, data: await this.freshCode() })
      return { paired: false as const, code: updated.pairCode, expiresAt: updated.pairExpiresAt }
    }
    return { paired: false as const, code: display.pairCode, expiresAt: display.pairExpiresAt }
  }

  async pair(siteId: string, code: string, terminalId?: string) {
    const display = await this.prisma.customerDisplay.findUnique({ where: { pairCode: code.replace(/\D/g, '') } })
    if (!display || !display.pairExpiresAt || display.pairExpiresAt < new Date()) {
      throw new BadRequestException('Code inconnu ou expiré : vérifiez le code affiché sur la tablette')
    }
    const paired = await this.prisma.customerDisplay.update({
      where: { id: display.id },
      data: { siteId, terminalId: terminalId ?? null, pairedAt: new Date(), pairCode: null, pairExpiresAt: null },
    })
    this.events.emit('display.paired', { displayId: paired.id })
    return { id: paired.id, pairedAt: paired.pairedAt }
  }

  list(siteId: string) {
    return this.prisma.customerDisplay.findMany({
      where: { siteId },
      select: { id: true, terminalId: true, pairedAt: true, lastSeenAt: true },
      orderBy: { pairedAt: 'desc' },
    })
  }

  async unpair(siteId: string, id: string) {
    const found = await this.prisma.customerDisplay.findFirst({ where: { id, siteId }, select: { id: true } })
    if (!found) throw new NotFoundException('Écran client introuvable')
    await this.prisma.customerDisplay.delete({ where: { id } })
    this.events.emit('display.unpaired', { displayId: id })
    return { success: true }
  }

  async byToken(token: string) {
    const display = await this.prisma.customerDisplay.findUnique({
      where: { tokenHash: hashDisplayToken(token) },
      include: { site: { select: { name: true, organizationId: true } } },
    })
    if (!display) throw new NotFoundException('Écran client inconnu')
    return display
  }

  // Code libre (contrainte d'unicité en base) valable dix minutes
  private async freshCode() {
    for (let i = 0; i < 10; i++) {
      const pairCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
      const taken = await this.prisma.customerDisplay.findUnique({ where: { pairCode }, select: { pairExpiresAt: true } })
      if (!taken || !taken.pairExpiresAt || taken.pairExpiresAt < new Date()) {
        if (taken) await this.prisma.customerDisplay.updateMany({ where: { pairCode }, data: { pairCode: null, pairExpiresAt: null } })
        return { pairCode, pairExpiresAt: new Date(Date.now() + CODE_TTL_MS) }
      }
    }
    throw new BadRequestException('Réessayez dans un instant')
  }
}
