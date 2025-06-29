import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common'

import { EmbeddingService } from './embedding.service'

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('')
  async embedding(@Body() body: { text: string }) {
    return this.embeddingService.getEmbedding(body.text)
  }

  @Post('generate/:repoId')
  async generate(@Param('repoId', ParseIntPipe) repoId: number) {
    return this.embeddingService.generateForRepo(repoId)
  }
}
