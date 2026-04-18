import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/session-auth.guard'
import { SelectUser } from '../db/schema'
import { DependenciesService } from './dependencies.service'

@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get(':repoId')
  @UseGuards(SessionAuthGuard)
  async getRepoDependencies(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.dependenciesService.getRepoDependencies(req.user.id, repoId)
  }

  @Get(':repoId/interactive')
  @UseGuards(SessionAuthGuard)
  async getRepoInteractiveGraph(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('depth') depth?: string,
    @Query('focusNodeId') focusNodeId?: string,
    @Query('includeSymbols') includeSymbols?: string,
    @Query('relationTypes') relationTypes?: string
  ) {
    return await this.dependenciesService.getRepoInteractiveGraph(req.user.id, repoId, {
      depth,
      focusNodeId,
      includeSymbols,
      relationTypes
    })
  }
}
