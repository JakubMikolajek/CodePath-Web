import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

import { User } from '../user/entities/user.entity'

import { ChatService } from './chat.service'
import { AskDto } from './dto/ask.dto'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post(':repoId')
  async ask(
    @Req() req: { user: User },
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body() body: AskDto,
  ) {
    return this.chatService.askAboutRepo(req.user.id, repoId, body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':repoId')
  async getRepoChats(
    @Req() req: { user: User },
    @Param('repoId', ParseIntPipe) repoId: number,
  ) {
    return this.chatService.getRepoChats(req.user.id, repoId)
  }
}
