import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { DocsService } from './services/docs.service'

@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) { }

  @Post('generate/:repoId')
  @UseGuards(SessionAuthGuard)
  async generateDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.generateDocumentation(req.user.id, repoId)
  }

  @Get(':repoId')
  @UseGuards(SessionAuthGuard)
  async getDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentation(req.user.id, repoId)
  }

  @Get('status/:repoId')
  @UseGuards(SessionAuthGuard)
  async getDocumentationStatus(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentationStatus(req.user.id, repoId)
  }
}
