import { Body, Controller, Post } from '@nestjs/common'

import { EmbeddingService } from './embedding.service'

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  @Post('')
  async embedding(@Body() body: { text: string }) {
    return this.embeddingService.getEmbedding(body.text)
  }
}
