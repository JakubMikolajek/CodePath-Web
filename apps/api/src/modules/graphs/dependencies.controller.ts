import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'

import { DependenciesService } from './dependencies.service'

@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get(':repoId')
  async getRepoDependencies(@Param('repoId', ParseIntPipe) repoId: number) {
    return await this.dependenciesService.getRepoDependencies(repoId)
  }
}
