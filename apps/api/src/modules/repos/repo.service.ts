import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { pick } from 'lodash'
import { Repository } from 'typeorm'

import { CreateRepoDto } from './dto/create-repo.dto'
import { Repo } from './entities/repo.entity'

@Injectable()
export class RepoService {
  constructor(
    @InjectRepository(Repo) private repoRepo: Repository<Repo>,
  ) {}

  async createRepo(userId: number, createRepoDto: CreateRepoDto) {
    const { name, gitUrl, accessKey } = createRepoDto

    const repo = this.repoRepo.create({
      name,
      gitUrl,
      accessKey,
      user: { id: userId },
    })
    const savedRepo = await this.repoRepo.save(repo)

    return { newRepo: pick(savedRepo, ['id', 'name', 'cloneStatus']) }
  }

  async getUserRepos(userId: number) {
    return await this.repoRepo.find({
      where: { user: { id: userId } },
      select: ['name', 'cloneStatus', 'id'],
    })
  }
}
