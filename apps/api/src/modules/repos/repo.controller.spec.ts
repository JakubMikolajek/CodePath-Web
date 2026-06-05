import { RepoController } from './repo.controller'

describe('RepoController', () => {
  it('delegates clone retry to repo service with authenticated user id', async () => {
    const repoService = {
      retryClonePipeline: jest.fn().mockResolvedValue({ id: 7 })
    }
    const controller = new RepoController(repoService as never)

    await expect(controller.retryClone({ user: { id: 3 } } as never, 7)).resolves.toEqual({ id: 7 })
    expect(repoService.retryClonePipeline).toHaveBeenCalledWith(3, 7)
  })

  it('delegates ingest retry to repo service with authenticated user id', async () => {
    const repoService = {
      retryIngestPipeline: jest.fn().mockResolvedValue({ id: 8 })
    }
    const controller = new RepoController(repoService as never)

    await expect(controller.retryIngest({ user: { id: 4 } } as never, 8)).resolves.toEqual({ id: 8 })
    expect(repoService.retryIngestPipeline).toHaveBeenCalledWith(4, 8)
  })
})
