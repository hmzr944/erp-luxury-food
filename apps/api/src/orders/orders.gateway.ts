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

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(OrdersGateway.name)

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  // Client joins a site room to receive its order events
  @SubscribeMessage('join-site')
  handleJoinSite(
    @MessageBody() data: { siteId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.siteId)
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
}
