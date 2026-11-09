import { test, expect } from '@playwright/test';

/**
 * E2E Test: Authentication Flow
 *
 * Tests the login functionality and protected route access
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check for login form elements
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // Should show error message
    await expect(
      page.getByText(/email or password is incorrect/i)
    ).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({
    page,
  }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    test.skip(!email || !password, 'Provide credentials for the disposable Console environment');
    await page.getByLabel('Email', { exact: true }).fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/dashboard|platform console/i)).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/platform/sources');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
  });
});
