import { expect, test } from '@playwright/test'

test.describe('Auth entrypoint', () => {
  test('renders login form by default', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Sign in with your CodePath identity provider')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Keycloak' })).toBeVisible()
  })

  test('switches to Keycloak registration action', async ({ page }) => {
    await page.goto('/')

    await page.getByText('Create one').click()
    await expect(page.getByText('Create account')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to registration' })).toBeVisible()
  })
})
