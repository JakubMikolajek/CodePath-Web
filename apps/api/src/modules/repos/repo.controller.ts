import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { SelectUser } from '../db/schema'
import { CreateRepoDto } from './dto/create-repo.dto'
import { RepoService } from './repo.service'

@Controller('repo')
export class RepoController {
  constructor(private readonly repoService: RepoService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
  async getUserRepos(@Req() req: { user: SelectUser }) {
    return await this.repoService.getUserRepos(req.user.id)
  }
}
