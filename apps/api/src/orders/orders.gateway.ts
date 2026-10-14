import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../common/prisma/prisma.service'

interface SocketUser {
  id: string
  role: string
  organizationId: string
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(OrdersGateway.name)

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  // Connexion refusée sans jeton valide : les ventes d'un site (articles,
  // montants, e-mails clients) ne sont diffusées qu'à son équipe
  async handleConnection(client: Socket) {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string; organizationId: string; tv?: number }>(token ?? '', {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
      })
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, organizationId: true, tokenVersion: true } })
      if (!user || user.tokenVersion !== (payload.tv ?? 0) || user.organizationId !== payload.organizationId) throw new Error('révoqué')
      client.data.user = { id: payload.sub, role: user.role, organizationId: user.organizationId } satisfies SocketUser
    } catch {
      client.emit('error', { message: 'Session expirée' })
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  // Client joins a site room to receive its order events
  @SubscribeMessage('join-site')
  async handleJoinSite(@MessageBody() data: { siteId: string }, @ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined
    if (!user || typeof data?.siteId !== 'string') return
    const site = await this.prisma.site.findUnique({ where: { id: data.siteId }, select: { organizationId: true } })
    if (!site || site.organizationId !== user.organizationId) return
    if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
      const link = await this.prisma.userSite.findUnique({ where: { userId_siteId: { userId: user.id, siteId: data.siteId } } })
      if (!link) return
    }
    await client.join(data.siteId)
    client.emit('joined', { siteId: data.siteId })
  }

  @SubscribeMessage('leave-site')
  handleLeaveSite(
    @MessageBody() data: { siteId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.siteId)
  }

  // Emitted by OrdersService after a successful checkout
  @OnEvent('order.created')
  emitNewOrder(payload: { siteId: string; order: unknown }) {
    this.server.to(payload.siteId).emit('order:new', payload.order)
  }

  @OnEvent('order.updated')
  emitOrderUpdated(payload: { siteId: string; order: unknown }) {
    this.server.to(payload.siteId).emit('order:updated', payload.order)
  }

  // Caisse oubliée après la fermeture : alerte en direct sur les écrans du site
  @OnEvent('routine.alert')
  emitRoutineAlert(payload: { siteId: string; day: string; pending: string[] }) {
    this.server.to(payload.siteId).emit('routine:alert', payload)
  }

  // Approvisionnement interne : la boutique et le labo voient le changement
  @OnEvent('supply.updated')
  emitSupplyUpdated(payload: { siteIds: string[]; orderId: string; status: string }) {
    for (const siteId of payload.siteIds) this.server.to(siteId).emit('supply:updated', payload)
  }
}
