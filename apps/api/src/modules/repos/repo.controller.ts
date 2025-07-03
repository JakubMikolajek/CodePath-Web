import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { User } from '../user/entities/user.entity'

import { CreateRepoDto } from './dto/create-repo.dto'
import { RepoService } from './repo.service'

@Controller('repo')
export class RepoController {
  constructor(private readonly repoService: RepoService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getUserRepos(@Req() req: { user: User }) {
    return await this.repoService.getUserRepos(req.user.id)
  }

  @Post()
  create(@Body() body: CreateRepoDto) {
    return this.repoService.createRepo(body)
  }
}
