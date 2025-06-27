import { Body, Controller, Post } from '@nestjs/common'

import { CreateRepoDto } from './dto/create-repo.dto'
import { RepoService } from './repo.service'

@Controller('repo')
export class RepoController {
  constructor(private readonly repoService: RepoService) {}

  @Post()
  create(@Body() body: CreateRepoDto) {
    return this.repoService.createRepo(body)
  }
}
