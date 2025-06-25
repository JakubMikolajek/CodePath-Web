import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class ChatService {
  constructor(private readonly httpService: HttpService) {}

  async getChat(prompt: string, context: string[]) {
    const response = await firstValueFrom(
      this.httpService.post('http://localhost:8000/chat', { prompt, context }),
    )
    return response.data
  }
}
