# E2E Testing Guide

This directory contains End-to-End (E2E) tests using Playwright.

## Setup

Install Playwright browsers:

```bash
npx playwright install
```

## Running Tests

Start the disposable managed stack with the repository launcher before live checks. The production fixture suite runs separately with `npm run build && npm run test:qualification`.

Run `npm run test:qualification -- workflows chromium` to exercise the isolated Media Studio, Economics, Real Experience, and AI Spend workflows against the built Console.

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

## Environment Variables

Set `CONSOLE_TEST_ORIGIN` explicitly when the managed Console is hosted away from
`http://localhost:3005`. Supply `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in the
test process for the live sign-in check. The fixture suite supplies its own
loopback origin and test identity.

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
- [ ] Responsive: Verify mobile sidebar and touch interactions
