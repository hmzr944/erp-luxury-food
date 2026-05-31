import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id },
      include: { settings: true },
    })
  }

  async getSettings(organizationId: string) {
    return this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    })
  }

  async upsertSettings(
    organizationId: string,
    data: {
      siret?: string
      vatNumber?: string
      legalForm?: string
      capital?: number
      rcs?: string
      legalAddress?: string
      legalCity?: string
      legalZipCode?: string
      pdpName?: string
      pdpEndpoint?: string
      pdpApiKey?: string
      pdpEnabled?: boolean
    },
  ) {
    return this.prisma.organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })
  }
}
