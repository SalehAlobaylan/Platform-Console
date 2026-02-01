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
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show error message
    await expect(
      page.getByText(/invalid credentials|failed to login/i)
    ).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({
    page,
  }) => {
    // Fill in valid credentials (requires test environment setup)
    await page
      .getByLabel(/email/i)
      .fill(process.env.TEST_USER_EMAIL || 'admin@example.com');
    await page
      .getByLabel(/password/i)
      .fill(process.env.TEST_USER_PASSWORD || 'password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/dashboard|platform console/i)).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/crm/customers');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
  });
});
