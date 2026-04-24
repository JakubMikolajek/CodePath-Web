import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { DocsController } from './docs.controller'
import { DocsService } from './services/docs.service'

@Module({
  controllers: [DocsController],
  imports: [HttpModule, AuthModule],
  providers: [DocsService]
})
export class DocsModule { }
