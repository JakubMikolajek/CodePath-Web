import { Module } from '@nestjs/common'
import axios from 'axios'

import { HTTP_CLIENT } from './http-client.tokens'

@Module({
  exports: [HTTP_CLIENT],
  providers: [
    {
      provide: HTTP_CLIENT,
      useFactory: () => axios.create()
    }
  ]
})
export class HttpClientModule {}
