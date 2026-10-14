import { Injectable, Logger } from '@nestjs/common'
import { metierByKey, type Metier } from '@erp/types'
import { PrismaService } from '../common/prisma/prisma.service'
import { ProductsService } from './products.service'
import type { CreateProductDto } from './dto/product.dto'

// Catalogue d'exemple du métier choisi à l'inscription : la caisse n'est pas
// vide, on peut essayer une vente tout de suite. Créé par le même chemin que
// les produits saisis à la main ; marqué « exemple » pour être retiré d'un geste.
@Injectable()
export class StarterService {
  private readonly logger = new Logger(StarterService.name)

  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
  ) {}

  async load(siteId: string, metierKey: string) {
    const metier = metierByKey(metierKey)
    if (!metier) return { products: 0 }
    try {
      return await this.create(siteId, metier)
    } catch (e) {
      // Un catalogue d'exemple raté ne doit pas empêcher l'inscription
      this.logger.error(`Catalogue d'exemple ${metierKey} : ${(e as Error).message}`)
      return { products: 0 }
    }
  }

  private async create(siteId: string, metier: Metier) {
    const categories = new Map<string, string>()
    for (const [position, c] of metier.categories.entries()) {
      const cat = await this.prisma.category.create({ data: { siteId, name: c.name, color: c.color, position } })
      categories.set(c.name, cat.id)
    }
    const groups = new Map<string, string>()
    for (const g of metier.modifierGroups ?? []) {
      const group = await this.products.createModifierGroup(siteId, {
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        modifiers: g.modifiers.map((m) => ({ name: m.name, price: m.price ?? 0 })),
      })
      groups.set(g.name, group.id)
    }

    const ids: string[] = []
    const byName = new Map<string, string>()
    for (const p of metier.products) {
      const dto: CreateProductDto = {
        name: p.name,
        subtitle: p.subtitle,
        price: p.price,
        taxRate: p.taxRate,
        categoryId: categories.get(p.category),
        // Pas de lot ni de n° de série sur des articles d'essai
        tracking: 'NONE' as CreateProductDto['tracking'],
        ...(p.options ? { options: p.options } : {}),
        ...(p.soldByWeight ? { soldByWeight: true } : {}),
        ...(p.modifierGroups?.length ? { modifierGroupIds: p.modifierGroups.map((n) => groups.get(n)!).filter(Boolean) } : {}),
      }
      const created = await this.products.create(siteId, dto)
      ids.push(created.id)
      byName.set(p.name, created.id)
    }
    for (const m of metier.menus ?? []) {
      const created = await this.products.create(siteId, {
        name: m.name,
        subtitle: m.subtitle,
        price: m.price,
        taxRate: 10,
        categoryId: categories.get(m.category),
        tracking: 'NONE' as CreateProductDto['tracking'],
        isMenu: true,
        menuSteps: m.steps.map((st) => ({
          name: st.name,
          minSelect: 1,
          maxSelect: 1,
          choices: st.choices.map((c) => byName.get(c)).filter((id): id is string => !!id).map((productId) => ({ productId })),
        })),
      } as CreateProductDto)
      ids.push(created.id)
    }
    await this.prisma.product.updateMany({ where: { id: { in: ids } }, data: { isSample: true } })
    return { products: ids.length }
  }

  // « Retirer les exemples » : supprimés s'ils n'ont jamais été vendus, sinon
  // retirés de la caisse (les ventes passées gardent leur article)
  async remove(siteId: string) {
    const samples = await this.prisma.product.findMany({
      where: { siteId, isSample: true },
      select: { id: true, categoryId: true, modifierGroups: { select: { groupId: true } }, _count: { select: { orderItems: true } } },
    })
    const categoryIds = [...new Set(samples.map((p) => p.categoryId).filter((x): x is string => !!x))]
    const groupIds = [...new Set(samples.flatMap((p) => p.modifierGroups.map((g) => g.groupId)))]
    const sold = samples.filter((p) => p._count.orderItems > 0).map((p) => p.id)
    const unsold = samples.filter((p) => p._count.orderItems === 0).map((p) => p.id)
    await this.prisma.$transaction(async (tx) => {
      if (sold.length) await tx.product.updateMany({ where: { id: { in: sold } }, data: { isActive: false } })
      if (unsold.length) {
        await tx.menuChoice.deleteMany({ where: { productId: { in: unsold } } })
        await tx.product.deleteMany({ where: { id: { in: unsold } } })
      }
      // Rayons et groupes d'options des exemples, s'ils ne servent plus à rien
      await tx.category.deleteMany({ where: { siteId, id: { in: categoryIds }, products: { none: {} } } })
      await tx.modifierGroup.deleteMany({ where: { siteId, id: { in: groupIds }, products: { none: {} } } })
    })
    return { removed: unsold.length, hidden: sold.length }
  }

  count(siteId: string) {
    return this.prisma.product.count({ where: { siteId, isSample: true, isActive: true } })
  }
}
