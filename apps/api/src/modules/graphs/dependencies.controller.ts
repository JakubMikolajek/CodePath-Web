import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { SelectUser } from '../db/schema'
import { DependenciesService } from './dependencies.service'

@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get(':repoId')
  @UseGuards(AuthGuard('jwt'))
  async getRepoDependencies(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.dependenciesService.getRepoDependencies(req.user.id, repoId)
  }
}
