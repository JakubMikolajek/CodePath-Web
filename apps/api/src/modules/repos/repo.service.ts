import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { CreateRepoDto } from './dto/create-repo.dto'
import { File } from './entities/file.entity'
import { Repo } from './entities/repo.entity'

@Injectable()
export class RepoService {
  constructor(
    @InjectRepository(Repo) private repoRepo: Repository<Repo>,
    @InjectRepository(File) private fileRepo: Repository<File>,
  ) {}

  async createRepo(createRepoDto: CreateRepoDto) {
    const { name, path, files } = createRepoDto

    const repo = this.repoRepo.create({ name, path })
    const savedRepo = await this.repoRepo.save(repo)

    const fileEntities = files.map(file => this.fileRepo.create({
      repoId: savedRepo.id,
      path: file.path,
      hash: file.hash,
      lastModified: new Date(file.lastModified),
    }))

    await this.fileRepo.save(fileEntities)

    return { repo: savedRepo, files: fileEntities }
  }
}
