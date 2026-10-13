import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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

  async create(organizationId: string, data: { name: string; address?: string; timezone?: string }) {
    return this.prisma.site.create({
      // organizationId en dernier : le corps de la requête ne peut pas le remplacer
      data: { name: data.name, address: data.address, timezone: data.timezone ?? 'Europe/Paris', organizationId },
    })
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
