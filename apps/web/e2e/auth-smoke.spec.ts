import { expect, test } from '@playwright/test'

test.describe('Auth entrypoint', () => {
  test('renders login form by default', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Login to your account')).toBeVisible()
    await expect(page.getByLabel('Email or Login')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('switches to register form from sign up action', async ({ page }) => {
    await page.goto('/')

    await page.getByText('Sign up').click()
    await expect(page.getByText('Create an account')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Login')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible()
  })
})
