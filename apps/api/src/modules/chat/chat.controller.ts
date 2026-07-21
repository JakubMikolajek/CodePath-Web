import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseIntPipe,
  Req,
  RequestMethod,
  Sse,
  UseGuards
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { AskDto } from './dto/ask.dto'
import { ChatService } from './services/chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @HttpCode(HttpStatus.OK)
  @Sse(':repoId', { method: RequestMethod.POST })
  @UseGuards(SessionAuthGuard)
  async ask(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: AskDto,
  ): Promise<Observable<MessageEvent>> {
    return this.chatService.askAboutRepo(req.user.id, repoId, body)
  }

  @Get(':repoId/createSession')
  @UseGuards(SessionAuthGuard)
  async createSession(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    return this.chatService.createSession(req.user.id, repoId)
  }

  @Get(':repoId/:sessionId')
  @UseGuards(SessionAuthGuard)
  async getChatSessionDetails(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Param('sessionId') sessionId: string) {
    return this.chatService.getChatSessionDetails(req.user.id, repoId, sessionId)
  }

  @Get(':repoId')
  @UseGuards(SessionAuthGuard)
  async getRepoChats(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    return this.chatService.getRepoChats(req.user.id, repoId)
  }
}
