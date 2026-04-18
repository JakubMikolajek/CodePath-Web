import { defineConfig, devices } from '@playwright/test'

const port = 3010

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  reporter: 'line',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `bun run dev -- --port ${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://localhost:${port}`
  }
})
