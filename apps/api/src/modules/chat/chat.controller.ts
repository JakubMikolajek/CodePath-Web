import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { SelectUser } from '../db/schema'
import { AskDto } from './dto/ask.dto'
import { ChatService } from './services/chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post(':repoId')
  @UseGuards(SessionAuthGuard)
  async ask(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: AskDto,
  ) {
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
