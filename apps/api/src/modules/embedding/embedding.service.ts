import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'

@Injectable()
export class EmbeddingService {
  constructor(private readonly httpService: HttpService) {}

  async getEmbedding(text: string) {
    const response = await firstValueFrom(
      this.httpService.post('http://localhost:8000/embedding', { text }),
    )

    return response.data
  }
}
