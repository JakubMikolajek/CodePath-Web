import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { CreateRepoDto } from './dto/create-repo.dto'
import { RepoService } from './services/repo.service'

@Controller('repo')
export class RepoController {
  constructor(private readonly repoService: RepoService) { }

  @Post()
  @UseGuards(SessionAuthGuard)
  create(
    @Req() req: { user: SelectUser },
    @Body() body: CreateRepoDto
  ) {
    return this.repoService.createRepo({
      ...body,
      userId: req.user.id
    })
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  async getUserRepos(@Req() req: { user: SelectUser }) {
    return await this.repoService.getUserRepos(req.user.id)
  }

  @Post(':repoId/retry-clone')
  @UseGuards(SessionAuthGuard)
  async retryClone(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.repoService.retryClonePipeline(req.user.id, repoId)
  }

  @Post(':repoId/retry-ingest')
  @UseGuards(SessionAuthGuard)
  async retryIngest(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.repoService.retryIngestPipeline(req.user.id, repoId)
  }
}
