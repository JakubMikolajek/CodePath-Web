import { Controller, Get, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SystemStatusResponse, SystemStatusService } from './services/system-status.service'

@Controller('system')
export class SystemStatusController {
  constructor(private readonly systemStatusService: SystemStatusService) { }

  @Get('status')
  @UseGuards(SessionAuthGuard)
  async getStatus(): Promise<SystemStatusResponse> {
    return await this.systemStatusService.getStatus()
  }
}
