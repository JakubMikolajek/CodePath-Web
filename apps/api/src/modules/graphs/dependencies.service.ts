import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Dependencies } from './entity/dependencies.entity'

@Injectable()
export class DependenciesService {
  constructor(
    @InjectRepository(Dependencies) private dependenciesRepo: Repository<Dependencies>
  ) {}

  private logger: Logger = new Logger(DependenciesService.name)

  async getRepoDependencies(repoId: number) {
    const dependencies = await this.dependenciesRepo.find({
      where: { repoId: repoId },
      order: { created_at: 'DESC' },
    })

    return dependencies.map(dep => ({
      from: dep.fromSymbol,
      to: dep.toSymbol,
      type: dep.type,
      fileId: dep.fileId,
    }))
  }
}
