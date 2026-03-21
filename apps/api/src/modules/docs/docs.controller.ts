import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { SelectUser } from '../db/schema'
import { DocsService } from './docs.service'

@Controller('docs')
export class DocsController {
  constructor(private readonly docsService: DocsService) { }

  @Post('generate/:repoId')
  @UseGuards(AuthGuard('jwt'))
  async generateDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.generateDocumentation(req.user.id, repoId)
  }

  @Get(':repoId')
  @UseGuards(AuthGuard('jwt'))
  async getDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentation(req.user.id, repoId)
  }
}
