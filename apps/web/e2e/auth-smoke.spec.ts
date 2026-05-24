import { expect, test } from '@playwright/test'

test.describe('Auth entrypoint', () => {
  test('renders login form by default', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Nurt Cloud')).toBeVisible()
    await expect(page.getByText('Authentication is handled through OpenID Connect. Nurt Cloud does not collect your password here.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('switches to Keycloak registration action', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page.getByText('Create account')).toBeVisible()
    await expect(page.getByText('Account creation is delegated to Keycloak. Use the registration option on the identity provider screen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to sign in' })).toBeVisible()
  })
})
