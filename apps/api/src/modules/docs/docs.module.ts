import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'

@Module({
  controllers: [DocsController],
  imports: [HttpModule],
  providers: [DocsService]
})
export class DocsModule { }
