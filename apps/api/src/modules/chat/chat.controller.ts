import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { SelectUser } from '../db/schema'

import { ChatService } from './chat.service'
import { AskDto } from './dto/ask.dto'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @UseGuards(AuthGuard('jwt'))
  @Get(':repoId/createSession')
  async createSession(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    return this.chatService.createSession(req.user.id, repoId)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':repoId')
  async ask(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: AskDto,
  ) {
    return this.chatService.askAboutRepo(req.user.id, repoId, body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':repoId')
  async getRepoChats(
    @Req() req: { user: SelectUser },
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    return this.chatService.getRepoChats(req.user.id, repoId)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':repoId/:sessionId')
  async getChatSessionDetails(
    @Req() req: { user: SelectUser },
    @Param('sessionId') sessionId: string) {
    return this.chatService.getChatSessionDetails(req.user.id, sessionId)
  }
}
