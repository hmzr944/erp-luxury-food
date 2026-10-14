import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { OnEvent } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../common/prisma/prisma.service'
import { DisplaysService } from './displays.service'

const MAX_STATE_BYTES = 64_000

// Relais en direct entre une caisse et sa tablette écran client. Le serveur
// garde le dernier état de chaque écran pour une tablette qui se reconnecte.
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
  namespace: '/display',
})
export class DisplaysGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server

  private last = new Map<string, unknown>()

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
    private displays: DisplaysService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = (client.handshake.auth ?? {}) as { token?: string; displayToken?: string }
    try {
      if (auth.displayToken) {
        const display = await this.displays.byToken(auth.displayToken)
        client.data.displayId = display.id
        await client.join(`display:${display.id}`)
        const state = this.last.get(display.id)
        if (state) client.emit('state', state)
        return
      }
      const payload = await this.jwt.verifyAsync<{ sub: string; organizationId: string; tv?: number }>(auth.token ?? '', {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
      })
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, organizationId: true, tokenVersion: true } })
      if (!user || user.tokenVersion !== (payload.tv ?? 0) || user.organizationId !== payload.organizationId) throw new Error('révoqué')
      client.data.user = { id: user.id, role: user.role, organizationId: user.organizationId }
      client.data.allowed = new Set<string>()
    } catch {
      client.emit('error', { message: 'Session expirée' })
      client.disconnect(true)
    }
  }

  // La caisse publie ce que voit le client
  @SubscribeMessage('state')
  async publish(@MessageBody() data: { displayId?: string; state?: unknown }, @ConnectedSocket() client: Socket) {
    const user = client.data.user as { id: string; role: string; organizationId: string } | undefined
    if (!user || typeof data?.displayId !== 'string' || !data.state) return
    if (JSON.stringify(data.state).length > MAX_STATE_BYTES) return
    const allowed = client.data.allowed as Set<string>
    if (!allowed.has(data.displayId)) {
      const display = await this.prisma.customerDisplay.findUnique({ where: { id: data.displayId }, select: { siteId: true, site: { select: { organizationId: true } } } })
      if (!display?.siteId || display.site?.organizationId !== user.organizationId) return
      if (user.role !== 'OWNER' && user.role !== 'MANAGER') {
        const link = await this.prisma.userSite.findUnique({ where: { userId_siteId: { userId: user.id, siteId: display.siteId } } })
        if (!link) return
      }
      allowed.add(data.displayId)
    }
    this.last.set(data.displayId, data.state)
    this.server.to(`display:${data.displayId}`).emit('state', data.state)
  }

  @OnEvent('display.paired')
  paired(payload: { displayId: string }) {
    this.server.to(`display:${payload.displayId}`).emit('paired')
  }

  @OnEvent('display.unpaired')
  unpaired(payload: { displayId: string }) {
    this.last.delete(payload.displayId)
    this.server.to(`display:${payload.displayId}`).emit('unpaired')
    this.server.in(`display:${payload.displayId}`).disconnectSockets(true)
  }
}
