import { Injectable } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'
import { encryptSecret, maskSecret, readSecret } from '../common/crypto/secrets'

export interface SettingsInput {
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
}

// La clé de la plateforme de facturation est chiffrée en base et n'est
// jamais renvoyée en clair
const masked = <T extends { pdpApiKey: string | null } | null>(s: T) =>
  s ? { ...s, pdpApiKey: s.pdpApiKey ? maskSecret(readSecret(s.pdpApiKey)) : null } : s

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, name: true, slug: true, plan: true, sector: true, packs: true, priceIncludesTax: true, currency: true,
        subscriptionStatus: true, trialEndsAt: true, createdAt: true, settings: true,
      },
    })
    return { ...org, settings: masked(org.settings) }
  }

  async getSettings(organizationId: string) {
    return masked(await this.prisma.organizationSettings.findUnique({ where: { organizationId } }))
  }

  // Champs listés un par un : rien d'autre ne peut être écrit (ni plan, ni sites)
  async upsertSettings(organizationId: string, input: SettingsInput) {
    const data = {
      siret: input.siret,
      vatNumber: input.vatNumber,
      legalForm: input.legalForm,
      capital: input.capital !== undefined ? new Decimal(input.capital) : undefined,
      rcs: input.rcs,
      legalAddress: input.legalAddress,
      legalCity: input.legalCity,
      legalZipCode: input.legalZipCode,
      pdpName: input.pdpName,
      pdpEndpoint: input.pdpEndpoint,
      pdpApiKey: input.pdpApiKey ? encryptSecret(input.pdpApiKey) : undefined,
      pdpEnabled: input.pdpEnabled,
    }
    return masked(
      await this.prisma.organizationSettings.upsert({
        where: { organizationId },
        create: { organizationId, ...data },
        update: data,
      }),
    )
  }
}
