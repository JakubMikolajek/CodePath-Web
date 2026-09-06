import { Test } from '@nestjs/testing'

import { AuthService } from '../../auth/services/auth.service'
import { RealtimeAuthService } from './realtime-auth.service'

describe('RealtimeAuthService', () => {
  const authService = { validateKeycloakAccessToken: jest.fn() }
  let service: RealtimeAuthService

  beforeEach(async () => {
    jest.resetAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        RealtimeAuthService,
        { provide: AuthService, useValue: authService }
      ]
    }).compile()

    service = module.get(RealtimeAuthService)
  })

  it('prefers the Socket.IO auth token over the authorization header', async () => {
    authService.validateKeycloakAccessToken.mockResolvedValue({ id: 7 })

    await expect(service.authenticate({
      auth: { token: 'socket-token' },
      headers: { authorization: 'Bearer header-token' }
    })).resolves.toEqual({ id: 7 })

    expect(authService.validateKeycloakAccessToken).toHaveBeenCalledWith('socket-token')
  })

  it('uses a bearer authorization header when handshake auth is absent', async () => {
    authService.validateKeycloakAccessToken.mockResolvedValue({ id: 8 })

    await service.authenticate({ headers: { authorization: 'Bearer header-token' } })

    expect(authService.validateKeycloakAccessToken).toHaveBeenCalledWith('header-token')
  })

  it('rejects a missing token without attempting validation', async () => {
    await expect(service.authenticate({ headers: {} })).resolves.toBeNull()

    expect(authService.validateKeycloakAccessToken).not.toHaveBeenCalled()
  })
})
