import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeAuthService } from './services/realtime-auth.service'
import { RealtimeDbChangeListenerService } from './services/realtime-db-change-listener.service'
import { RealtimeEventsService } from './services/realtime-events.service'
import { RealtimeRoomService } from './services/realtime-room.service'

@Module({
  exports: [RealtimeEventsService, RealtimeRoomService],
  imports: [AuthModule],
  providers: [
    RealtimeAuthService,
    RealtimeRoomService,
    RealtimeGateway,
    RealtimeEventsService,
    RealtimeDbChangeListenerService
  ]
})
export class RealtimeModule { }
