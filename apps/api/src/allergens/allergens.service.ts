import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class AllergensService {
  constructor(private prisma: PrismaService) {}

  // Liste des 14 INCO
  findAll() {
    return this.prisma.allergen.findMany({ orderBy: { name: 'asc' } })
  }

  // Allergènes d'un produit avec flag "traces"
  async getProductAllergens(productId: string, siteId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, siteId },
      select: { id: true },
    })
    if (!product) throw new NotFoundException('Produit introuvable')

    return this.prisma.productAllergen.findMany({
      where: { productId },
      include: { allergen: true },
    })
  }

  // Tous les produits d'un site avec leurs allergènes
  getProductsWithAllergens(siteId: string) {
    return this.prisma.product.findMany({
      where: { siteId, isActive: true },
      include: {
        allergens: { include: { allergen: true } },
        category: { select: { name: true, color: true } },
      },
      orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
    })
  }

  // Mettre à jour les allergènes d'un produit
  async setProductAllergens(
    productId: string,
    siteId: string,
    allergens: Array<{ allergenId: string; traces: boolean }>,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, siteId },
      include: { variants: { select: { id: true } } },
    })
    if (!product) throw new NotFoundException('Produit introuvable')

    await this.prisma.$transaction(async (tx) => {
      // Supprime les allergènes existants du produit
      await tx.productAllergen.deleteMany({ where: { productId } })

      // Recrée la liste
      if (allergens.length > 0) {
        await tx.productAllergen.createMany({
          data: allergens.map((a) => ({
            productId,
            allergenId: a.allergenId,
            traces: a.traces,
          })),
        })
      }
    })

    return this.getProductAllergens(productId, siteId)
  }
}
