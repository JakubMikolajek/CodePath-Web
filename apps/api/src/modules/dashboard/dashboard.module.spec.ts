import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { AuthService } from '../auth/services/auth.service'
import { DbService } from '../db/services/db.service'
import { QdrantService } from '../qdrant/services/qdrant.service'
import { DashboardModule } from './dashboard.module'
import { DashboardService } from './dashboard.service'

describe('DashboardModule DI smoke', () => {
  let moduleRef: TestingModule

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('compiles its module graph with imported database and Qdrant providers', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DashboardModule]
    })
      .overrideProvider(AuthService)
      .useValue({ validateKeycloakAccessToken: jest.fn() })
      .overrideProvider(DbService)
      .useValue({ dbClient: {} })
      .overrideProvider(QdrantService)
      .useValue({ count: jest.fn() })
      .compile()

    expect(moduleRef.get(DashboardService)).toBeDefined()
  })
})
