import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { EvaluationService } from './services/evaluation.service'

interface TriggerEvaluationBody {
  runType?: unknown
}

@Controller('evaluation')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get(':repoId/runs')
  @UseGuards(SessionAuthGuard)
  async listRuns(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('limit') limit?: string
  ) {
    return await this.evaluationService.listRuns(req.user.id, repoId, limit)
  }

  @Get(':repoId/runs/:runId/metrics')
  @UseGuards(SessionAuthGuard)
  async getRunMetrics(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('runId', ParseIntPipe) runId: number
  ) {
    return await this.evaluationService.getRunMetrics(req.user.id, repoId, runId)
  }

  @Get(':repoId/trend')
  @UseGuards(SessionAuthGuard)
  async getTrend(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.evaluationService.getTrend(req.user.id, repoId)
  }

  @Post(':repoId/trigger')
  @UseGuards(SessionAuthGuard)
  async triggerEvaluation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: TriggerEvaluationBody
  ) {
    return await this.evaluationService.triggerEvaluation(req.user.id, repoId, body?.runType)
  }
}
