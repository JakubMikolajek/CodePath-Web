import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common'

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
}
