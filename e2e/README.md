# E2E Testing Guide

This directory contains End-to-End (E2E) tests using Playwright.

## Setup

Install Playwright browsers:

```bash
npx playwright install
```

## Running Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run with UI mode (for debugging)
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific project (browser)
npx playwright test --project=chromium
```

## Test Structure

- `auth.spec.ts` - Authentication flows (login, logout, protected routes)
- `platform-sources.spec.ts` - Platform sources management
- `crm.spec.ts` - CRM customers and deals management

## Environment Variables

Create a `.env.local` file for test configuration:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
TEST_USER_EMAIL=admin@example.com
TEST_USER_PASSWORD=password
```

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Use the `test` and `expect` functions from `@playwright/test`
3. Group related tests with `test.describe()`
4. Use `test.beforeEach()` for common setup

Example:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature-url');
  });

  test('should do something', async ({ page }) => {
    await page.click('button');
    await expect(page.locator('.result')).toHaveText('Success');
  });
});
```

## TODO

The following E2E tests need to be implemented:

- [ ] Authentication: Complete login flow with test credentials
- [ ] Platform: Create source, edit source, run ingestion
- [ ] CRM: Create customer, add contact, create deal
- [ ] CRM: Move deal through pipeline stages
- [ ] Responsive: Verify mobile sidebar and touch interactions
