import { Test, type TestingModule } from '@nestjs/testing'

import { DbModule } from '../db/db.module'
import { DbService } from '../db/services/db.service'
import { OrchestratorClient } from '../orchestrator-client/services/orchestrator-client.service'
import { QdrantService } from '../qdrant/services/qdrant.service'
import { DependenciesModule } from './dependencies.module'
import { DependenciesService } from './services/dependencies.service'

describe('DependenciesModule dependency injection', () => {
  let moduleRef: TestingModule | undefined

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('resolves DependenciesService with the orchestrator client owner module imported', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DbModule, DependenciesModule]
    })
      .overrideProvider(DbService)
      .useValue({ dbClient: {} })
      .overrideProvider(QdrantService)
      .useValue({ scroll: jest.fn() })
      .overrideProvider(OrchestratorClient)
      .useValue({ graphRpc: jest.fn() })
      .compile()

    expect(moduleRef.get(DependenciesService)).toBeDefined()
    expect(moduleRef.get(OrchestratorClient)).toBeDefined()
  })
})
