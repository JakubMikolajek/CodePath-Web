import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'

import { DocsService } from './docs.service'

@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) { }

  @Post('generate/:repoId')
  async generateDocumentation(@Param('repoId', ParseIntPipe) repoId: number) {
    return await this.docsService.generateDocumentation(repoId)
  }

  @Get(':repoId')
  async getDocumentation(@Param('repoId', ParseIntPipe) repoId: number) {
    return await this.docsService.getDocumentation(repoId)
  }
}
