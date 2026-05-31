import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { Decimal } from '@prisma/client/runtime/library'

export interface CreateB2BClientDto {
  name: string
  siret?: string
  vatNumber?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  zipCode?: string
  country?: string
  discount?: number
  paymentTerms?: number
  notes?: string
}

@Injectable()
export class B2BClientsService {
  constructor(private prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.b2BClient.findMany({
      where: { organizationId },
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const client = await this.prisma.b2BClient.findFirst({
      where: { id, organizationId },
      include: {
        orders: {
          select: {
            id: true, total: true, status: true,
            createdAt: true, invoiceNumber: true,
            receiptChain: { select: { counter: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!client) throw new NotFoundException('Client introuvable')
    return client
  }

  create(organizationId: string, dto: CreateB2BClientDto) {
    return this.prisma.b2BClient.create({
      data: {
        ...dto,
        organizationId,
        discount: dto.discount !== undefined ? new Decimal(dto.discount) : undefined,
        paymentTerms: dto.paymentTerms ?? 30,
      },
    })
  }

  async update(id: string, organizationId: string, dto: Partial<CreateB2BClientDto>) {
    const client = await this.prisma.b2BClient.findFirst({ where: { id, organizationId } })
    if (!client) throw new NotFoundException('Client introuvable')
    return this.prisma.b2BClient.update({
      where: { id },
      data: {
        ...dto,
        discount: dto.discount !== undefined ? new Decimal(dto.discount) : undefined,
      },
    })
  }

  async remove(id: string, organizationId: string) {
    const client = await this.prisma.b2BClient.findFirst({ where: { id, organizationId } })
    if (!client) throw new NotFoundException('Client introuvable')
    await this.prisma.b2BClient.delete({ where: { id } })
    return { success: true }
  }

  // Statistiques du client
  async getStats(id: string, organizationId: string) {
    const client = await this.prisma.b2BClient.findFirst({ where: { id, organizationId } })
    if (!client) throw new NotFoundException('Client introuvable')

    const agg = await this.prisma.order.aggregate({
      where: { b2bClientId: id, status: 'COMPLETED' },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    })

    return {
      totalOrders: agg._count,
      totalRevenue: Number(agg._sum.total ?? 0),
      avgOrder: Number(agg._avg.total ?? 0),
    }
  }
}
