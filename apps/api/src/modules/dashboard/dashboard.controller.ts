import { Controller, Get, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { DashboardService } from './dashboard.service'
import { DashboardSummaryResponse } from './dto/dashboard-summary.response'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('summary')
  @UseGuards(SessionAuthGuard)
  async getSummary(@Req() req: { user: SelectUser }): Promise<DashboardSummaryResponse> {
    return await this.dashboardService.getSummary(req.user.id)
  }
}
