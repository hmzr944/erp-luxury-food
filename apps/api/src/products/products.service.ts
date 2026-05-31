import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { Decimal } from '@prisma/client/runtime/library'
import { PrismaService } from '../common/prisma/prisma.service'

export interface CreateProductDto {
  name: string
  subtitle?: string
  description?: string
  sku?: string
  barcode?: string
  price: number
  taxRate?: number
  categoryId?: string
  imageUrl?: string
  variants?: Array<{ name: string; price: number; barcode?: string }>
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  isActive?: boolean
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(siteId: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: { siteId, ...(includeInactive ? {} : { isActive: true }) },
      include: {
        category: { select: { id: true, name: true, color: true, position: true } },
        variants: true,
        allergens: { include: { allergen: { select: { name: true, code: true } } } },
        stockItem: { select: { quantity: true, unit: true, alertAt: true } },
      },
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
      include: {
        category: true,
        variants: true,
        allergens: { include: { allergen: true } },
        stockItem: true,
      },
    })
    if (!product) throw new NotFoundException('Produit introuvable')
    return product
  }

  async findByBarcode(barcode: string, siteId: string) {
    return this.prisma.product.findFirst({
      where: {
        siteId, isActive: true,
        OR: [{ barcode }, { variants: { some: { barcode } } }],
      },
      include: { category: true, variants: true },
    })
  }

  async create(siteId: string, dto: CreateProductDto) {
    if (dto.sku) {
      const exists = await this.prisma.product.findFirst({ where: { siteId, sku: dto.sku } })
      if (exists) throw new ConflictException(`SKU "${dto.sku}" déjà utilisé sur ce site`)
    }

    const { variants, ...productData } = dto
    return this.prisma.product.create({
      data: {
        ...productData,
        siteId,
        price: new Decimal(dto.price),
        taxRate: new Decimal(dto.taxRate ?? 5.5),
        ...(variants?.length ? {
          variants: { create: variants.map((v) => ({ ...v, price: new Decimal(v.price) })) },
        } : {}),
      },
      include: { category: true, variants: true },
    })
  }

  async update(id: string, siteId: string, dto: UpdateProductDto) {
    await this.findById(id, siteId)
    const { variants, ...productData } = dto

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          ...productData,
          ...(dto.price !== undefined ? { price: new Decimal(dto.price) } : {}),
          ...(dto.taxRate !== undefined ? { taxRate: new Decimal(dto.taxRate) } : {}),
        },
        include: { category: true, variants: true },
      })

      // Remplace les variants si fournis
      if (variants !== undefined) {
        await tx.variant.deleteMany({ where: { productId: id } })
        if (variants.length) {
          await tx.variant.createMany({
            data: variants.map((v) => ({ ...v, productId: id, price: new Decimal(v.price) })),
          })
        }
      }

      return product
    })
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

  // ── Catégories ─────────────────────────────────────────────

  async createCategory(siteId: string, data: { name: string; color?: string; position?: number }) {
    const maxPos = await this.prisma.category.aggregate({
      where: { siteId },
      _max: { position: true },
    })
    return this.prisma.category.create({
      data: { siteId, ...data, position: data.position ?? (maxPos._max.position ?? 0) + 1 },
    })
  }

  async updateCategory(id: string, siteId: string, data: { name?: string; color?: string; position?: number }) {
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
