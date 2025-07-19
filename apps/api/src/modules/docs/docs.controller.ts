import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'

import { DocsService } from './docs.service'

@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get('generate/:repoId')
  async generateDocumentation(@Param('repoId', ParseIntPipe) repoId: number) {
    return await this.docsService.generateDocumentation(repoId)
  }
}
