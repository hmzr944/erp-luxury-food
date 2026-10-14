import { createHash } from 'crypto'
import { gunzipSync, gzipSync } from 'zlib'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { ClosurePeriod } from '@prisma/client'
import { FISCAL_SOFTWARE } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'
import { SigningKeyService } from './signing-key.service'
import { FiscalEventsService } from './fiscal-events.service'

export const ARCHIVE_FORMAT = 'flow-archive-fiscale'
export const ARCHIVE_VERSION = 1

// Archives fiscales (BOI-TVA-DECLA-30-10-30 § 220-260) : à chaque clôture
// mensuelle et annuelle, les données de la période sont figées dans un
// fichier JSON (format ouvert, lisible sans FLŌW), daté, scellé par une
// empreinte SHA-256 et signé par la clé de l'éditeur. L'archive est gardée
// telle quelle en base (ajout seul) et se télécharge à tout moment.
@Injectable()
export class ArchivesService {
  private readonly logger = new Logger(ArchivesService.name)

  constructor(
    private prisma: PrismaService,
    private keys: SigningKeyService,
    private events: FiscalEventsService,
  ) {}

  list(siteId: string) {
    return this.prisma.fiscalArchive.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, period: true, label: true, fromCounter: true, toCounter: true, sha256: true, keyId: true, size: true, createdAt: true },
    })
  }

  // Crée l'archive d'une période clôturée si elle n'existe pas encore
  async ensure(siteId: string, period: ClosurePeriod, label: string, userId: string | null) {
    const existing = await this.prisma.fiscalArchive.findUnique({ where: { siteId_period_label: { siteId, period, label } } })
    if (existing) return existing
    try {
      return await this.create(siteId, period, label, userId)
    } catch (e) {
      // Deux créations simultanées : la première a gagné
      const again = await this.prisma.fiscalArchive.findUnique({ where: { siteId_period_label: { siteId, period, label } } })
      if (again) return again
      this.logger.error(`Archive ${period} ${label} du site ${siteId} : ${(e as Error).message}`)
      throw e
    }
  }

  private async create(siteId: string, period: ClosurePeriod, label: string, userId: string | null) {
    const closure = await this.prisma.fiscalClosure.findUnique({ where: { siteId_period_label: { siteId, period, label } } })
    if (!closure) throw new NotFoundException('Période non clôturée : rien à archiver')

    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        address: true,
        timezone: true,
        organization: { select: { id: true, name: true, settings: { select: { siret: true, vatNumber: true, legalAddress: true, legalZipCode: true, legalCity: true } } } },
      },
    })

    const childPeriod = period === 'YEAR' ? 'MONTH' : 'DAY'
    const closures = await this.prisma.fiscalClosure.findMany({
      where: { siteId, OR: [{ id: closure.id }, { period: childPeriod, label: { startsWith: label + '-' } }, ...(period === 'YEAR' ? [{ period: 'DAY' as const, label: { startsWith: label + '-' } }] : [])] },
      orderBy: [{ period: 'asc' }, { seq: 'asc' }],
    })

    const from = closure.firstCounter
    const to = closure.lastCounter
    const receipts =
      from != null && to != null
        ? await this.prisma.receiptChain.findMany({
            where: { siteId, counter: { gte: from, lte: to } },
            orderBy: { counter: 'asc' },
            include: {
              order: {
                select: {
                  id: true,
                  kind: true,
                  refundOfId: true,
                  refundReason: true,
                  channel: true,
                  subtotal: true,
                  taxAmount: true,
                  total: true,
                  discount: true,
                  soldAt: true,
                  createdAt: true,
                  clientId: true,
                  invoiceNumber: true,
                  items: { select: { name: true, variantName: true, serialNumber: true, price: true, taxRate: true, quantity: true, discount: true, productId: true, variantId: true, refundOfItemId: true } },
                  payments: { select: { code: true, label: true, kind: true, amount: true, reference: true } },
                },
              },
            },
          })
        : []

    // Période calendaire couverte par les tickets (bornes des événements joints)
    const startAt = receipts[0]?.signedAt ?? closure.closedAt
    const endAt = closure.closedAt
    const orderIds = receipts.map((r) => r.order?.id).filter((x): x is string => !!x)
    const [duplicates, trainings, events] = await Promise.all([
      orderIds.length ? this.prisma.receiptDuplicate.findMany({ where: { orderId: { in: orderIds } }, orderBy: { createdAt: 'asc' } }) : [],
      this.prisma.trainingTicket.findMany({ where: { siteId, createdAt: { gte: startAt, lte: endAt } }, orderBy: { number: 'asc' } }),
      this.prisma.fiscalEvent.findMany({ where: { organizationId: site.organization.id, siteId, createdAt: { gte: startAt, lte: endAt } }, orderBy: { seq: 'asc' } }),
    ])

    const data = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_VERSION,
      software: FISCAL_SOFTWARE,
      createdAt: new Date().toISOString(),
      period: { kind: period, label, firstCounter: from, lastCounter: to },
      organization: { id: site.organization.id, name: site.organization.name, ...site.organization.settings },
      site: { id: site.id, name: site.name, address: site.address, timezone: site.timezone },
      closures,
      receipts: receipts.map((r) => ({
        counter: r.counter,
        signedAt: r.signedAt,
        version: r.version,
        kind: r.kind,
        total: r.total,
        perpetualTotal: r.perpetualTotal,
        perpetualAbsTotal: r.perpetualAbsTotal,
        previousHash: r.previousHash,
        hash: r.hash,
        contentDigest: r.contentDigest,
        terminal: r.terminalId
          ? { id: r.terminalId, counter: r.terminalCounter, hash: r.terminalHash, previousHash: r.terminalPreviousHash, signature: r.terminalSignature, signedAt: r.terminalSignedAt }
          : null,
        order: r.order,
      })),
      duplicates,
      trainingTickets: trainings,
      events,
    }

    // Les montants Decimal deviennent des chaînes « 12.50 » : lisibles partout
    const json = JSON.stringify(data, (_k, v) => (v && typeof v === 'object' && typeof v.toFixed === 'function' && 'd' in v ? v.toFixed(2) : v))
    const sha256 = createHash('sha256').update(json).digest('hex')
    const { signature, keyId } = await this.keys.sign(json)
    const content = gzipSync(Buffer.from(json, 'utf8'))

    const archive = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fiscalArchive.create({
        data: { siteId, period, label, fromCounter: from, toCounter: to, sha256, signature, keyId, size: json.length, content, createdById: userId },
      })
      await this.events.record(tx, {
        organizationId: site.organization.id,
        siteId,
        code: 'ARCHIVE_CREATED',
        userId,
        detail: { period, label, sha256, size: json.length },
      })
      return created
    })
    return archive
  }

  // Fichier téléchargé : enveloppe lisible par n'importe quel outil. `data`
  // est la chaîne JSON exacte dont l'empreinte et la signature sont données.
  async download(siteId: string, id: string, userId: string | null) {
    const archive = await this.prisma.fiscalArchive.findFirst({ where: { id, siteId } })
    if (!archive) throw new NotFoundException('Archive introuvable')
    const json = gunzipSync(archive.content).toString('utf8')
    const intact = createHash('sha256').update(json).digest('hex') === archive.sha256 && (await this.keys.verify(json, archive.signature))
    const key = await this.keys.publicKey()
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { organizationId: true } })
    await this.events.log({ organizationId: site.organizationId, siteId, code: 'ARCHIVE_DOWNLOADED', userId, detail: { period: archive.period, label: archive.label } })

    const envelope = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_VERSION,
      manifest: {
        period: archive.period,
        label: archive.label,
        firstCounter: archive.fromCounter,
        lastCounter: archive.toCounter,
        createdAt: archive.createdAt,
        sha256: archive.sha256,
        intactAtDownload: intact,
      },
      verification: {
        method: 'SHA-256 de la chaîne « data » (UTF-8), puis signature ECDSA P-256 (DER, base64) de cette même chaîne avec la clé publique ci-dessous',
        keyId: archive.keyId,
        publicKey: key.publicKeyPem,
        signature: archive.signature,
      },
      data: json,
    }
    return { filename: `flow-archive-${archive.period.toLowerCase()}-${archive.label}.json`, body: JSON.stringify(envelope, null, 2), intact }
  }
}
