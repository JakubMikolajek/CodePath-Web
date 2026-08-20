import { Logger } from '@nestjs/common'
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets'
import { WebSocketGateway } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'

import { resolveCorsOrigin } from '../../config/env'
import { RealtimeAuthService } from './services/realtime-auth.service'
import { RealtimeRoomService } from './services/realtime-room.service'

interface AuthenticatedSocketData {
  userId?: number
}

// Socket.IO rooms are in-memory for the current single-replica deployment; add cross-instance fan-out when replicas increase.
@WebSocketGateway({
  cors: { origin: resolveCorsOrigin() },
  namespace: '/realtime'
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  server!: Server

  private readonly logger = new Logger(RealtimeGateway.name)

  constructor(
    private readonly realtimeAuthService: RealtimeAuthService,
    private readonly realtimeRoomService: RealtimeRoomService
  ) {}

  afterInit(server: Server): void {
    this.server = server

    server.use(async (socket, next) => {
      let user

      try {
        user = await this.realtimeAuthService.authenticate(socket.handshake)
      } catch {
        next(new Error('Unauthorized realtime connection'))
        return
      }

      if (!user) return next(new Error('Unauthorized realtime connection'))

      const socketData = socket.data as AuthenticatedSocketData
      socketData.userId = user.id
      next()
    })
  }

  handleConnection(socket: Socket): void {
    const userId = (socket.data as AuthenticatedSocketData).userId

    if (!userId) {
      socket.disconnect(true)
      return
    }

    void socket.join(this.realtimeRoomService.user(userId))
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Realtime socket disconnected: ${socket.id}`)
  }
}
