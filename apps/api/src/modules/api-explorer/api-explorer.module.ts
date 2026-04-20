import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { ApiExplorerController } from './api-explorer.controller'
import { ApiExplorerService } from './api-explorer.service'

@Module({
  controllers: [ApiExplorerController],
  imports: [AuthModule, QdrantModule],
  providers: [ApiExplorerService]
})
export class ApiExplorerModule {}
