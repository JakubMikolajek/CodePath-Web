import { Controller } from '@nestjs/common'

import { EmbeddingService } from './embedding.service'

@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) { }
}
