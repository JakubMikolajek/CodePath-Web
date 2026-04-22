import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import type {
  RepoApiRunnerRequest,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest
} from '@workspace/codepath-common/api-explorer'

import { SessionAuthGuard } from '../auth/session-auth.guard'
import { SelectUser } from '../db/schema'
import { ApiExplorerService } from './api-explorer.service'

@Controller('api-explorer')
export class ApiExplorerController {
  constructor(private readonly apiExplorerService: ApiExplorerService) {}

  @Delete(':repoId/auth-presets/:presetId')
  @UseGuards(SessionAuthGuard)
  async deleteRunnerAuthPreset(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('presetId', ParseIntPipe) presetId: number
  ) {
    return await this.apiExplorerService.deleteRunnerAuthPreset(req.user.id, repoId, presetId)
  }

  @Delete(':repoId/collections/:collectionId')
  @UseGuards(SessionAuthGuard)
  async deleteRunnerCollection(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('collectionId', ParseIntPipe) collectionId: number
  ) {
    return await this.apiExplorerService.deleteRunnerCollection(req.user.id, repoId, collectionId)
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
    @Query('runtimeBaseUrl') runtimeBaseUrl?: string,
    @Query('search') search?: string
  ) {
    return await this.apiExplorerService.getRepoOpenApiSpec(req.user.id, repoId, {
      frameworks,
      methods,
      runtimeBaseUrl,
      search
    })
  }

  @Get(':repoId/auth-presets')
  @UseGuards(SessionAuthGuard)
  async listRunnerAuthPresets(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.apiExplorerService.listRunnerAuthPresets(req.user.id, repoId)
  }

  @Get(':repoId/collections')
  @UseGuards(SessionAuthGuard)
  async listRunnerCollections(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number
  ) {
    return await this.apiExplorerService.listRunnerCollections(req.user.id, repoId)
  }

  @Post(':repoId/run')
  @UseGuards(SessionAuthGuard)
  async runRepoApiRequest(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: RepoApiRunnerRequest
  ) {
    return await this.apiExplorerService.runApiRequest(req.user.id, repoId, body)
  }

  @Post(':repoId/auth-presets')
  @UseGuards(SessionAuthGuard)
  async saveRunnerAuthPreset(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: RepoApiRunnerSaveAuthPresetRequest
  ) {
    return await this.apiExplorerService.saveRunnerAuthPreset(req.user.id, repoId, body)
  }

  @Post(':repoId/collections')
  @UseGuards(SessionAuthGuard)
  async saveRunnerCollection(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: RepoApiRunnerSaveCollectionRequest
  ) {
    return await this.apiExplorerService.saveRunnerCollection(req.user.id, repoId, body)
  }
}
