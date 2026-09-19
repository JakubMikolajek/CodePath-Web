import { DashboardController } from './dashboard.controller'

describe('DashboardController', () => {
  it('delegates only the authenticated user id to the dashboard service', async () => {
    const dashboardService = { getSummary: jest.fn().mockResolvedValue({ repositories: 2 }) }
    const controller = new DashboardController(dashboardService as never)

    await expect(controller.getSummary({ user: { id: 42 } } as never)).resolves.toEqual({ repositories: 2 })
    expect(dashboardService.getSummary).toHaveBeenCalledWith(42)
  })
})
