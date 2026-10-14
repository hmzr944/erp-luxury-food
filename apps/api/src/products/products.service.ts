import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { SECTOR_PRESETS, type Sector } from '@erp/types'
import { buildVariantMatrix, variantLabel } from '@erp/utils'
import { PrismaService } from '../common/prisma/prisma.service'
import { validateAttributes } from './attributes'
import { isBarcode, lookupBarcode } from './lookup'
import type {
  CategoryDto,
  CreateProductDto,
  MenuStepDto,
  ModifierGroupDto,
  ProductOptionDto,
  UpdateCategoryDto,
  UpdateProductDto,
  VariantDto,
} from './dto/product.dto'

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, color: true, position: true } },
  options: { orderBy: { position: 'asc' } },
  variants: {
    where: { isActive: true },
    orderBy: { position: 'asc' },
    include: { stock: { select: { quantity: true, alertAt: true } } },
  },
  allergens: { include: { allergen: { select: { name: true, code: true } } } },
  stockItem: { select: { quantity: true, unit: true, alertAt: true } },
  modifierGroups: {
    where: { group: { isActive: true } },
    orderBy: { position: 'asc' },
    select: {
      group: {
        select: {
          id: true, name: true, minSelect: true, maxSelect: true,
          modifiers: { where: { isActive: true }, orderBy: { position: 'asc' }, select: { id: true, name: true, price: true } },
        },
      },
    },
  },
  menuSteps: {
    orderBy: { position: 'asc' },
    select: {
      id: true, name: true, minSelect: true, maxSelect: true,
      choices: { orderBy: { position: 'asc' }, select: { id: true, productId: true, variantId: true, supplement: true } },
    },
  },
} satisfies Prisma.ProductInclude

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(siteId: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: { siteId, isCustom: false, ...(includeInactive ? {} : { isActive: true }) },
      include: PRODUCT_INCLUDE,
      orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
    })
  }

  findCategories(siteId: string) {
    return this.prisma.category.findMany({
      where: { siteId },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
      orderBy: { position: 'asc' },
    })
  }

  async findById(id: string, siteId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, siteId },
      include: PRODUCT_INCLUDE,
    })
    if (!product) throw new NotFoundException('Produit introuvable')
    return product
  }

  async findByBarcode(barcode: string, siteId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        siteId, isActive: true,
        OR: [{ barcode }, { variants: { some: { barcode, isActive: true } } }],
      },
      include: PRODUCT_INCLUDE,
    })
    if (!product) return null
    // Le code scanné peut désigner une variante précise (taille, couleur...)
    const variant = product.variants.find((v) => v.barcode === barcode) ?? null
    return { ...product, matchedVariantId: variant?.id ?? null }
  }

  async create(siteId: string, dto: CreateProductDto) {
    if (dto.sku) {
      const exists = await this.prisma.product.findFirst({ where: { siteId, sku: dto.sku } })
      if (exists) throw new ConflictException(`SKU "${dto.sku}" déjà utilisé sur ce site`)
    }

    const org = await this.organizationOf(siteId)
    const attributes = await this.checkAttributes(org.id, dto.attributes ?? {})
    const options = this.normalizeOptions(dto.options)
    const variants = dto.variants ?? this.generateVariants(options, dto.price)
    await this.checkComposition(siteId, dto)

    return this.prisma.product.create({
      data: {
        siteId,
        name: dto.name,
        subtitle: dto.subtitle,
        description: dto.description,
        sku: dto.sku,
        barcode: dto.barcode,
        categoryId: dto.categoryId,
        imageUrl: dto.imageUrl,
        price: new Decimal(dto.price),
        taxRate: new Decimal(dto.taxRate ?? org.defaultTaxRate),
        tracking: dto.tracking ?? SECTOR_PRESETS[org.sector as Sector].defaultTracking,
        mealVoucherEligible: dto.mealVoucherEligible ?? defaultMealVoucher(org.sector, dto.taxRate ?? org.defaultTaxRate),
        attributes: attributes as Prisma.InputJsonObject,
        isMenu: dto.isMenu ?? false,
        soldByWeight: dto.soldByWeight ?? false,
        scaleCode: dto.scaleCode || null,
        modifierGroups: { create: (dto.modifierGroupIds ?? []).map((groupId, position) => ({ groupId, position })) },
        menuSteps: { create: (dto.menuSteps ?? []).map((st, position) => this.stepData(st, position)) },
        options: { create: options.map((o, position) => ({ ...o, position })) },
        variants: { create: variants.map((v, position) => this.variantData(v, position)) },
      },
      include: PRODUCT_INCLUDE,
    })
  }

  async update(id: string, siteId: string, dto: UpdateProductDto) {
    const current = await this.findById(id, siteId)
    const org = await this.organizationOf(siteId)
    const { variants, options, attributes, price, taxRate, modifierGroupIds, menuSteps, scaleCode, ...rest } = dto
    await this.checkComposition(siteId, dto, id)
    const checkedAttributes =
      attributes !== undefined ? await this.checkAttributes(org.id, attributes) : undefined

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(price !== undefined ? { price: new Decimal(price) } : {}),
          ...(taxRate !== undefined ? { taxRate: new Decimal(taxRate) } : {}),
          ...(scaleCode !== undefined ? { scaleCode: scaleCode || null } : {}),
          ...(checkedAttributes ? { attributes: checkedAttributes as Prisma.InputJsonObject } : {}),
        },
      })

      if (options !== undefined) {
        const normalized = this.normalizeOptions(options)
        await tx.productOption.deleteMany({ where: { productId: id } })
        await tx.productOption.createMany({
          data: normalized.map((o, position) => ({ ...o, productId: id, position })),
        })
      }

      if (modifierGroupIds !== undefined) {
        await tx.productModifierGroup.deleteMany({ where: { productId: id } })
        await tx.productModifierGroup.createMany({ data: modifierGroupIds.map((groupId, position) => ({ productId: id, groupId, position })) })
      }

      // Les ventes gardent leur copie de la formule : on peut la réécrire
      if (menuSteps !== undefined) {
        await tx.menuStep.deleteMany({ where: { menuId: id } })
        for (const [position, st] of menuSteps.entries()) {
          await tx.menuStep.create({ data: { menuId: id, ...this.stepData(st, position) } })
        }
      }

      if (variants !== undefined) {
        // Les variantes retirées sont désactivées, jamais supprimées :
        // leur stock et l'historique des ventes restent rattachés
        const keptIds = new Set(variants.filter((v) => v.id).map((v) => v.id!))
        const unknown = [...keptIds].filter((vid) => !current.variants.some((v) => v.id === vid))
        if (unknown.length) {
          const known = await tx.variant.count({ where: { id: { in: unknown }, productId: id } })
          if (known !== unknown.length) throw new BadRequestException('Variante inconnue pour ce produit')
        }
        await tx.variant.updateMany({
          where: { productId: id, id: { notIn: [...keptIds] } },
          data: { isActive: false },
        })
        for (const [position, v] of variants.entries()) {
          const data = this.variantData(v, position)
          if (v.id) await tx.variant.update({ where: { id: v.id }, data: { ...data, isActive: v.isActive ?? true } })
          else await tx.variant.create({ data: { ...data, productId: id } })
        }
      }
    })

    return this.findById(id, siteId)
  }

  async remove(id: string, siteId: string) {
    await this.findById(id, siteId)
    // Soft delete — conserve l'historique des ventes
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    })
  }

  // Produit technique « Article libre » du site, créé à la première demande
  async customProduct(siteId: string) {
    const existing = await this.prisma.product.findFirst({ where: { siteId, isCustom: true }, select: { id: true, taxRate: true } })
    if (existing) return existing
    const org = await this.organizationOf(siteId)
    return this.prisma.product.create({
      data: { siteId, name: 'Article libre', price: new Decimal(0), taxRate: new Decimal(org.defaultTaxRate), isCustom: true, isActive: false },
      select: { id: true, taxRate: true },
    })
  }

  // Code-barres scanné : produit déjà au catalogue, ou fiche proposée par les bases ouvertes
  async lookup(siteId: string, code: string) {
    const existing = await this.findByBarcode(code, siteId)
    if (existing) return { existingProductId: existing.id, suggestion: null }
    if (!isBarcode(code)) return { existingProductId: null, suggestion: null }
    const suggestion = await lookupBarcode(code, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5000) }))
    return { existingProductId: null, suggestion }
  }

  // Aperçu des variantes avant enregistrement (grille taille × couleur...)
  previewVariants(options: ProductOptionDto[], price: number) {
    return this.generateVariants(this.normalizeOptions(options), price)
  }

  private generateVariants(options: ProductOptionDto[], price: number): VariantDto[] {
    try {
      return buildVariantMatrix(options).map((combination) => ({
        name: variantLabel(combination, options),
        price,
        options: combination,
      }))
    } catch (e) {
      throw new BadRequestException((e as Error).message)
    }
  }

  private stepData(st: MenuStepDto, position: number) {
    return {
      name: st.name.trim(),
      minSelect: st.minSelect,
      maxSelect: Math.max(st.maxSelect, st.minSelect, 1),
      position,
      choices: {
        create: st.choices.map((c, k) => ({ productId: c.productId, variantId: c.variantId || null, supplement: new Decimal(c.supplement ?? 0), position: k })),
      },
    }
  }

  // Groupes d'options du site ; composants de formule du site, jamais une formule
  private async checkComposition(siteId: string, dto: Partial<CreateProductDto>, selfId?: string) {
    if (dto.modifierGroupIds?.length) {
      const ids = [...new Set(dto.modifierGroupIds)]
      if (ids.length !== dto.modifierGroupIds.length) throw new BadRequestException("Groupe d'options en double")
      const found = await this.prisma.modifierGroup.count({ where: { id: { in: ids }, siteId } })
      if (found !== ids.length) throw new BadRequestException("Groupe d'options inconnu sur ce site")
    }
    if (dto.isMenu && dto.soldByWeight) throw new BadRequestException('Une formule ne se vend pas au poids')
    const steps = dto.menuSteps ?? []
    if (!steps.length) return
    if (dto.isMenu === false) throw new BadRequestException('Étapes de formule sur un produit qui n’est pas une formule')
    for (const st of steps) {
      if (!st.choices.length) throw new BadRequestException(`Étape « ${st.name} » : ajoutez au moins un article`)
      if (st.minSelect > st.choices.length) throw new BadRequestException(`Étape « ${st.name} » : plus de choix obligatoires que d'articles`)
    }
    const ids = [...new Set(steps.flatMap((st) => st.choices.map((c) => c.productId)))]
    if (selfId && ids.includes(selfId)) throw new BadRequestException('Une formule ne peut pas se contenir elle-même')
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, siteId },
      select: { id: true, name: true, isMenu: true, soldByWeight: true, variants: { where: { isActive: true }, select: { id: true } } },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    for (const c of steps.flatMap((st) => st.choices)) {
      const p = byId.get(c.productId)
      if (!p) throw new BadRequestException('Article de formule inconnu sur ce site')
      if (p.isMenu) throw new BadRequestException(`${p.name} est déjà une formule`)
      if (p.soldByWeight) throw new BadRequestException(`${p.name} se vend au poids : il ne peut pas entrer dans une formule`)
      if (c.variantId && !p.variants.some((v) => v.id === c.variantId)) throw new BadRequestException(`Variante inconnue pour ${p.name}`)
    }
  }

  // ── Options et suppléments ─────────────────────────────────

  findModifierGroups(siteId: string) {
    return this.prisma.modifierGroup.findMany({
      where: { siteId, isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        modifiers: { where: { isActive: true }, orderBy: { position: 'asc' }, select: { id: true, name: true, price: true } },
        _count: { select: { products: true } },
      },
    })
  }

  async createModifierGroup(siteId: string, dto: ModifierGroupDto) {
    this.checkGroup(dto)
    const max = await this.prisma.modifierGroup.aggregate({ where: { siteId }, _max: { position: true } })
    return this.prisma.modifierGroup.create({
      data: {
        siteId,
        name: dto.name.trim(),
        minSelect: dto.minSelect,
        maxSelect: dto.maxSelect ?? null,
        position: (max._max.position ?? 0) + 1,
        modifiers: { create: dto.modifiers.map((m, position) => ({ name: m.name.trim(), price: new Decimal(m.price), position })) },
      },
      include: { modifiers: { select: { id: true, name: true, price: true } } },
    })
  }

  async updateModifierGroup(id: string, siteId: string, dto: ModifierGroupDto) {
    this.checkGroup(dto)
    const group = await this.prisma.modifierGroup.findFirst({ where: { id, siteId }, include: { modifiers: { select: { id: true } } } })
    if (!group) throw new NotFoundException("Groupe d'options introuvable")
    const known = new Set(group.modifiers.map((m) => m.id))
    if (dto.modifiers.some((m) => m.id && !known.has(m.id))) throw new BadRequestException('Option inconnue pour ce groupe')
    await this.prisma.$transaction(async (tx) => {
      await tx.modifierGroup.update({ where: { id }, data: { name: dto.name.trim(), minSelect: dto.minSelect, maxSelect: dto.maxSelect ?? null } })
      // Une option retirée est désactivée : les ventes passées la citent encore
      const kept = dto.modifiers.filter((m) => m.id).map((m) => m.id!)
      await tx.modifier.updateMany({ where: { groupId: id, id: { notIn: kept } }, data: { isActive: false } })
      for (const [position, m] of dto.modifiers.entries()) {
        const data = { name: m.name.trim(), price: new Decimal(m.price), position, isActive: true }
        if (m.id) await tx.modifier.update({ where: { id: m.id }, data })
        else await tx.modifier.create({ data: { ...data, groupId: id } })
      }
    })
    return this.prisma.modifierGroup.findUniqueOrThrow({
      where: { id },
      include: { modifiers: { where: { isActive: true }, orderBy: { position: 'asc' }, select: { id: true, name: true, price: true } } },
    })
  }

  async removeModifierGroup(id: string, siteId: string) {
    const group = await this.prisma.modifierGroup.findFirst({ where: { id, siteId }, select: { id: true } })
    if (!group) throw new NotFoundException("Groupe d'options introuvable")
    await this.prisma.$transaction([
      this.prisma.productModifierGroup.deleteMany({ where: { groupId: id } }),
      this.prisma.modifierGroup.update({ where: { id }, data: { isActive: false } }),
    ])
    return { success: true }
  }

  private checkGroup(dto: ModifierGroupDto) {
    if (!dto.modifiers.length) throw new BadRequestException('Ajoutez au moins une option')
    if (dto.maxSelect != null && dto.maxSelect < dto.minSelect) throw new BadRequestException('Le maximum est inférieur au minimum')
    if (dto.minSelect > dto.modifiers.length) throw new BadRequestException("Plus de choix obligatoires que d'options")
  }

  private normalizeOptions(options: ProductOptionDto[] = []): ProductOptionDto[] {
    const names = new Set<string>()
    return options.map((o) => {
      const name = o.name.trim()
      if (names.has(name.toLowerCase())) throw new BadRequestException(`Option en double : ${name}`)
      names.add(name.toLowerCase())
      return { name, values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))] }
    })
  }

  private variantData(v: VariantDto, position: number) {
    return {
      name: v.name,
      price: new Decimal(v.price),
      barcode: v.barcode,
      sku: v.sku,
      options: (v.options ?? {}) as Prisma.InputJsonObject,
      position,
    }
  }

  private async organizationOf(siteId: string) {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        organization: {
          select: {
            id: true,
            sector: true,
            taxRates: { where: { isDefault: true }, select: { rate: true }, take: 1 },
          },
        },
      },
    })
    const org = site.organization
    return { id: org.id, sector: org.sector, defaultTaxRate: Number(org.taxRates[0]?.rate ?? 20) }
  }

  private async checkAttributes(organizationId: string, values: Record<string, unknown>) {
    const defs = await this.prisma.attributeDefinition.findMany({ where: { organizationId } })
    const result = validateAttributes(defs, values)
    if (result.errors.length) throw new BadRequestException(result.errors)
    return result.values
  }

  // ── Catégories ─────────────────────────────────────────────

  async createCategory(siteId: string, data: CategoryDto) {
    const maxPos = await this.prisma.category.aggregate({
      where: { siteId },
      _max: { position: true },
    })
    return this.prisma.category.create({
      data: { siteId, ...data, position: data.position ?? (maxPos._max.position ?? 0) + 1 },
    })
  }

  async updateCategory(id: string, siteId: string, data: UpdateCategoryDto) {
    const cat = await this.prisma.category.findFirst({ where: { id, siteId } })
    if (!cat) throw new NotFoundException('Catégorie introuvable')
    return this.prisma.category.update({ where: { id }, data })
  }

  async removeCategory(id: string, siteId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, siteId } })
    if (!cat) throw new NotFoundException('Catégorie introuvable')
    // Détache les produits avant suppression
    await this.prisma.product.updateMany({ where: { categoryId: id, siteId }, data: { categoryId: null } })
    await this.prisma.category.delete({ where: { id } })
    return { success: true }
  }
}

// Titre-restaurant : par défaut, l'alimentaire aux taux réduits (pas l'alcool à 20 %)
function defaultMealVoucher(sector: string, taxRate: number) {
  return sector === 'FOOD' && (taxRate === 5.5 || taxRate === 10)
}
