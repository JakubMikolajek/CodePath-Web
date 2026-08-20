import { Test } from '@nestjs/testing'

import { RealtimeGateway } from './realtime.gateway'
import { RealtimeAuthService } from './services/realtime-auth.service'
import { RealtimeRoomService } from './services/realtime-room.service'

describe('RealtimeGateway', () => {
  const realtimeAuthService = { authenticate: jest.fn() }
  const realtimeRoomService = { user: jest.fn((userId: number) => `user:${userId}`) }
  let gateway: RealtimeGateway
  let middleware: (socket: never, next: (error?: Error) => void) => Promise<void>

  beforeEach(async () => {
    jest.resetAllMocks()
    realtimeRoomService.user.mockImplementation((userId: number) => `user:${userId}`)

    const module = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: RealtimeAuthService, useValue: realtimeAuthService },
        { provide: RealtimeRoomService, useValue: realtimeRoomService }
      ]
    }).compile()
    gateway = module.get(RealtimeGateway)

    gateway.afterInit({ use: jest.fn(handler => { middleware = handler }) } as never)
  })

  it('accepts an authenticated connection and stores its user id', async () => {
    realtimeAuthService.authenticate.mockResolvedValue({ id: 4 })
    const socket = { data: {}, handshake: {} }
    const next = jest.fn()

    await middleware(socket as never, next)

    expect(socket.data).toEqual({ userId: 4 })
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects an invalid connection before it can join a room', async () => {
    realtimeAuthService.authenticate.mockResolvedValue(null)
    const next = jest.fn()

    await middleware({ data: {}, handshake: {} } as never, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized realtime connection' }))
  })

  it('joins exactly the authenticated user room', () => {
    const socket = { data: { userId: 14 }, join: jest.fn().mockResolvedValue(undefined) }

    gateway.handleConnection(socket as never)

    expect(realtimeRoomService.user).toHaveBeenCalledWith(14)
    expect(socket.join).toHaveBeenCalledWith('user:14')
  })
})
