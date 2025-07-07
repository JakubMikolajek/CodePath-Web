import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common'

import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':repoId')
  async ask(
    @Param('repoId', ParseIntPipe) repoId: number,
    @Body('question') question: string,
  ) {
    return this.chatService.askAboutRepo(repoId, question)
  }
}
