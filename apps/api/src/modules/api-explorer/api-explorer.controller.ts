import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/session-auth.guard'
import { SelectUser } from '../db/schema'
import { ApiExplorerService } from './api-explorer.service'

@Controller('api-explorer')
export class ApiExplorerController {
  constructor(private readonly apiExplorerService: ApiExplorerService) {}

  @Get(':repoId/endpoints.json')
  @UseGuards(SessionAuthGuard)
  async getRepoInteractiveApiJson(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('frameworks') frameworks?: string,
    @Query('methods') methods?: string,
    @Query('search') search?: string
  ) {
    return await this.apiExplorerService.getRepoInteractiveApi(req.user.id, repoId, {
      frameworks,
      methods,
      search
    })
  }

  @Get(':repoId/openapi.json')
  @UseGuards(SessionAuthGuard)
  async getRepoOpenApiSpec(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('frameworks') frameworks?: string,
    @Query('methods') methods?: string,
    @Query('search') search?: string
  ) {
    return await this.apiExplorerService.getRepoOpenApiSpec(req.user.id, repoId, {
      frameworks,
      methods,
      search
    })
  }

  @Get(':repoId')
  @UseGuards(SessionAuthGuard)
  async getRepoInteractiveApi(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Query('frameworks') frameworks?: string,
    @Query('methods') methods?: string,
    @Query('search') search?: string
  ) {
    return await this.apiExplorerService.getRepoInteractiveApi(req.user.id, repoId, {
      frameworks,
      methods,
      search
    })
  }
}
