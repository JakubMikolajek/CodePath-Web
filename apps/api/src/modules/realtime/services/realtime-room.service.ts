import { Injectable } from '@nestjs/common'

@Injectable()
export class RealtimeRoomService {
  user(userId: number): string {
    return `user:${userId}`
  }
}
