import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { RepoDocsSectionKey } from '@workspace/codepath-common/repository'

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

  @Post('generate/:repoId/modules/:moduleKey')
  @UseGuards(SessionAuthGuard)
  async generateModuleDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('moduleKey') moduleKey: string
  ) {
    return await this.docsService.generateDocumentation(req.user.id, repoId, { moduleKey })
  }

  @Post('generate/:repoId/modules/:moduleKey/sections/:sectionKey')
  @UseGuards(SessionAuthGuard)
  async generateSectionDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('moduleKey') moduleKey: string,
    @Param('sectionKey') sectionKey: RepoDocsSectionKey
  ) {
    return await this.docsService.generateDocumentation(req.user.id, repoId, { moduleKey, sectionKey })
  }

  @Get('status/:repoId')
  @UseGuards(SessionAuthGuard)
  async getDocumentationStatus(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentationStatus(req.user.id, repoId)
  }

  @Get(':repoId/modules')
  @UseGuards(SessionAuthGuard)
  async getDocumentationModules(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentationModules(req.user.id, repoId)
  }

  @Get(':repoId/sections')
  @UseGuards(SessionAuthGuard)
  async getDocumentationSections(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentationModules(req.user.id, repoId)
  }

  @Get(':repoId')
  @UseGuards(SessionAuthGuard)
  async getDocumentation(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.docsService.getDocumentation(req.user.id, repoId)
  }
}
