import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { metierByKey } from '@erp/types'
import { CatalogCopyService } from '../products/catalog-copy.service'
import { StarterService } from '../products/starter.service'

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private catalogCopy: CatalogCopyService,
    private starter: StarterService,
  ) {}

  findByOrganization(organizationId: string, onlyForUserId?: string) {
    return this.prisma.site.findMany({
      where: { organizationId, ...(onlyForUserId ? { users: { some: { userId: onlyForUserId } } } : {}) },
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async assertInOrganization(id: string, organizationId: string) {
    const site = await this.prisma.site.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!site) throw new NotFoundException('Site introuvable')
  }

  findById(id: string) {
    return this.prisma.site.findUniqueOrThrow({ where: { id } })
  }

  async create(
    organizationId: string,
    data: { name: string; address?: string; timezone?: string; copyCatalogFromSiteId?: string; starterMetier?: string },
  ) {
    // Avant de créer quoi que ce soit : un site source étranger ou un métier inconnu refuse tout
    if (data.copyCatalogFromSiteId && data.starterMetier) {
      throw new BadRequestException('Choisissez soit la copie d’un catalogue, soit celui d’un métier')
    }
    if (data.copyCatalogFromSiteId) {
      const source = await this.prisma.site.findFirst({
        where: { id: data.copyCatalogFromSiteId, organizationId },
        select: { id: true },
      })
      if (!source) throw new NotFoundException('Site à copier introuvable')
    }
    if (data.starterMetier && !metierByKey(data.starterMetier)) throw new BadRequestException('Métier inconnu')

    const site = await this.prisma.site.create({
      // organizationId en dernier : le corps de la requête ne peut pas le remplacer
      data: { name: data.name, address: data.address, timezone: data.timezone ?? 'Europe/Paris', organizationId },
    })
    if (!data.copyCatalogFromSiteId && !data.starterMetier) return site

    // Le site existe déjà : une copie ratée ne doit pas faire croire qu'il manque
    // (un nouvel essai créerait un doublon). Le catalogue se recopie depuis le site.
    try {
      if (data.copyCatalogFromSiteId) {
        const catalogCopy = await this.catalogCopy.copy(site.id, data.copyCatalogFromSiteId, organizationId)
        return { ...site, catalogCopy }
      }
      const starter = await this.starter.load(site.id, data.starterMetier!)
      return { ...site, starter }
    } catch (e) {
      this.logger.error(`Catalogue du site ${site.id} : ${(e as Error).message}`)
      return { ...site, catalogError: 'Le site est créé, mais son catalogue n’a pas pu être préparé. Vous pouvez le copier depuis les réglages des sites.' }
    }
  }

  async update(id: string, organizationId: string, data: { name?: string; address?: string; timezone?: string }) {
    const site = await this.prisma.site.findFirst({ where: { id, organizationId } })
    if (!site) throw new NotFoundException('Site introuvable')
    return this.prisma.site.update({ where: { id }, data: { name: data.name, address: data.address, timezone: data.timezone } })
  }

  // Récupère les imprimantes disponibles via PrintNode
  async getPrinters(siteId: string): Promise<any[]> {
    const apiKey = this.config.get('PRINTNODE_API_KEY')
    if (!apiKey) return []

    try {
      const res = await fetch('https://api.printnode.com/printers', {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        },
      })
      if (!res.ok) return []
      return (await res.json()) as any[]
    } catch {
      return []
    }
  }

  async testPrint(siteId: string, printerId: number): Promise<{ success: boolean }> {
    const apiKey = this.config.get('PRINTNODE_API_KEY')
    if (!apiKey) return { success: false }

    const testContent = [
      'TEST IMPRESSION',
      '─'.repeat(32),
      'ERP Luxury Food',
      new Date().toLocaleString('fr-FR'),
      '─'.repeat(32),
      'Impression OK',
      '\n\n',
    ].join('\n')

    const res = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printerId,
        title: 'ERP Test Print',
        contentType: 'raw_base64',
        content: Buffer.from(testContent).toString('base64'),
        source: 'ERP',
      }),
    })
    return { success: res.ok }
  }
}
