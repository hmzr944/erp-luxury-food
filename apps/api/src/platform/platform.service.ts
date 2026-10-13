import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { PACK_ATTRIBUTES, SECTOR_PRESETS, type Pack, type Sector } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'
import type {
  AttributeDefinitionDto,
  PaymentMethodDto,
  TaxRateDto,
  UpdatePlatformDto,
} from './dto/platform.dto'

type Tx = Prisma.TransactionClient

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  // Tout ce dont la caisse et le back-office ont besoin pour s'adapter au métier
  async getConfig(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        sector: true,
        packs: true,
        priceIncludesTax: true,
        currency: true,
        taxRates: { orderBy: { rate: 'desc' } },
        paymentMethods: { orderBy: { position: 'asc' } },
        attributeDefinitions: { orderBy: [{ position: 'asc' }, { label: 'asc' }] },
      },
    })
    if (!org) throw new NotFoundException('Organisation introuvable')
    const preset = SECTOR_PRESETS[org.sector as Sector]
    return {
      ...org,
      defaultTracking: preset.defaultTracking,
      suggestedOptions: preset.suggestedOptions,
    }
  }

  // Applique les préréglages d'un secteur. N'efface rien : les taux, moyens
  // de paiement et champs déjà créés par l'organisation sont conservés.
  async applySector(organizationId: string, sector: Sector) {
    const preset = SECTOR_PRESETS[sector]
    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { sector, packs: preset.packs, priceIncludesTax: preset.priceIncludesTax },
      })

      const defaultRate = preset.taxRates.find((t) => t.isDefault)
      if (defaultRate) {
        await tx.taxRate.updateMany({ where: { organizationId }, data: { isDefault: false } })
      }
      for (const t of preset.taxRates) {
        await tx.taxRate.upsert({
          where: { organizationId_rate: { organizationId, rate: new Decimal(t.rate) } },
          create: { organizationId, label: t.label, rate: new Decimal(t.rate), isDefault: !!t.isDefault },
          update: { isDefault: !!t.isDefault },
        })
      }

      const existing = await tx.paymentMethod.count({ where: { organizationId } })
      for (const [i, m] of preset.paymentMethods.entries()) {
        await tx.paymentMethod.upsert({
          where: { organizationId_code: { organizationId, code: m.code } },
          create: { organizationId, ...m, position: existing + i },
          update: { isActive: true },
        })
      }

      await this.ensurePackAttributes(tx, organizationId, preset.packs)
    })
    return this.getConfig(organizationId)
  }

  async update(organizationId: string, dto: UpdatePlatformDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: organizationId }, data: dto })
      if (dto.packs) await this.ensurePackAttributes(tx, organizationId, dto.packs)
    })
    return this.getConfig(organizationId)
  }

  // Crée les champs produit fournis par chaque pack activé (sans écraser
  // un champ de même clé déjà personnalisé par l'organisation)
  private async ensurePackAttributes(tx: Tx, organizationId: string, packs: Pack[]) {
    const attrs = packs.flatMap((p) => PACK_ATTRIBUTES[p])
    if (!attrs.length) return
    await tx.attributeDefinition.createMany({
      data: attrs.map((a, i) => ({
        organizationId,
        key: a.key,
        label: a.label,
        type: a.type,
        options: a.options ?? [],
        pack: a.pack,
        position: i,
      })),
      skipDuplicates: true,
    })
  }

  // ── TVA ─────────────────────────────────────────────────────

  async upsertTaxRate(organizationId: string, dto: TaxRateDto, id?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.taxRate.updateMany({ where: { organizationId }, data: { isDefault: false } })
      }
      const data = { label: dto.label, rate: new Decimal(dto.rate), isDefault: dto.isDefault ?? false }
      if (id) {
        await this.assertOwned(tx.taxRate, id, organizationId)
        return tx.taxRate.update({ where: { id }, data })
      }
      return tx.taxRate.create({ data: { organizationId, ...data } }).catch(this.duplicate('Ce taux existe déjà'))
    })
  }

  async removeTaxRate(organizationId: string, id: string) {
    await this.assertOwned(this.prisma.taxRate, id, organizationId)
    await this.prisma.taxRate.delete({ where: { id } })
    return { success: true }
  }

  // ── Moyens de paiement ──────────────────────────────────────

  async upsertPaymentMethod(organizationId: string, dto: PaymentMethodDto, id?: string) {
    if (id) {
      await this.assertOwned(this.prisma.paymentMethod, id, organizationId)
      return this.prisma.paymentMethod.update({ where: { id }, data: dto })
    }
    return this.prisma.paymentMethod
      .create({ data: { organizationId, ...dto } })
      .catch(this.duplicate(`Le code ${dto.code} existe déjà`))
  }

  // Désactivation plutôt que suppression : les anciennes ventes y font référence
  async disablePaymentMethod(organizationId: string, id: string) {
    await this.assertOwned(this.prisma.paymentMethod, id, organizationId)
    return this.prisma.paymentMethod.update({ where: { id }, data: { isActive: false } })
  }

  // ── Champs produit personnalisés ────────────────────────────

  async upsertAttribute(organizationId: string, dto: AttributeDefinitionDto, id?: string) {
    if (dto.type === 'SELECT' && !dto.options?.length) {
      throw new BadRequestException('Une liste de choix doit avoir au moins une valeur')
    }
    const data = { ...dto, options: dto.options ?? [] }
    if (id) {
      await this.assertOwned(this.prisma.attributeDefinition, id, organizationId)
      // La clé reste figée : les produits stockent leurs valeurs sous cette clé
      const { key: _key, ...rest } = data
      return this.prisma.attributeDefinition.update({ where: { id }, data: rest })
    }
    return this.prisma.attributeDefinition
      .create({ data: { organizationId, ...data } })
      .catch(this.duplicate(`Le champ ${dto.key} existe déjà`))
  }

  async removeAttribute(organizationId: string, id: string) {
    await this.assertOwned(this.prisma.attributeDefinition, id, organizationId)
    await this.prisma.attributeDefinition.delete({ where: { id } })
    return { success: true }
  }

  private async assertOwned(
    delegate: { findFirst: (args: { where: { id: string; organizationId: string } }) => Promise<unknown> },
    id: string,
    organizationId: string,
  ) {
    const found = await delegate.findFirst({ where: { id, organizationId } })
    if (!found) throw new NotFoundException('Élément introuvable')
  }

  private duplicate(message: string) {
    return (e: unknown): never => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(message)
      }
      throw e
    }
  }
}
