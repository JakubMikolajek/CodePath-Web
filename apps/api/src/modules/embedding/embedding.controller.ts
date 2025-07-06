import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'

import { EmbeddingService } from './embedding.service'

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Get(':repoId')
  async embed(@Param('repoId', ParseIntPipe) repoId: number) {
    return await this.embeddingService.embedRepo(repoId)
  }

  @Get(':shouldBeEmbedded/:repoId')
  async shouldBeEmbedded(@Param('repoId') repoId: number) {
    return await this.embeddingService.shouldBeEmbedded(repoId)
  }
}
