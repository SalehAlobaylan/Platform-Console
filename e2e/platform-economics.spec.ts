import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const now = new Date().toISOString();
const fixture = () => ({
  policy: {
    enabled: false,
    aggregation_interval_minutes: 7,
    forecast_horizon_days: 30,
    retention_days: 90,
    spike_multiplier: 4,
  },
  budgets: [
    {
      id: 1,
      scope: 'class:llm',
      cap_usd: 10,
      warn_pct: 70,
      hard_pct: 100,
      spend_usd: 3,
      reserved_usd: 0,
      window_started_at: now,
    },
  ],
  episodes: [],
  budget_verdicts: { 'class:llm': { verdict: 'within' } },
  compute_watch: [
    {
      spend_class: 'embedding',
      unit: 'items',
      used: 20,
      daily_threshold: 100,
      status: 'within',
      day: now.slice(0, 10),
      enforcement: 'advisory',
    },
  ],
  totals: {
    cost_usd: 123.456,
    avoided_cost_usd: 2,
    avoided_estimated_usd: 0.5,
    events: 510,
    cache_hits: 2,
    estimated_events: 0,
    unpriced_events: 0,
    unknown_events: 0,
    usage_unavailable_events: 0,
  },
  breakdown: {
    day: [
      {
        key: now.slice(0, 10),
        cost_usd: 123.456,
        events: 510,
        avoided_cost_usd: 2,
        avoided_estimated_usd: 0.5,
      },
    ],
    spend_class: [],
    provider: [],
    model: [],
    trigger_source: [],
  },
  units: [],
  daily_by_class: [
    { day: now.slice(0, 10), spend_class: 'llm', cost_usd: 60 },
    { day: now.slice(0, 10), spend_class: 'stt_api', cost_usd: 63.456 },
  ],
  evidence: {
    ledger_health: 'healthy',
    event_count: 510,
    rollup_count: 510,
    run_count: 1,
    last_rollup_at: now,
    emitters: [],
  },
  allowance: { allowed: true, reason: 'governor_disabled' },
  coverage: [],
  storage: { url: '/platform/storage', status: 'unavailable' },
});

const account = '11111111-1111-4111-8111-111111111111';
const source = {
  id: '22222222-2222-4222-8222-222222222222',
  provider: 'fixture-host',
  resource: 'database',
  scope: 'qualification project',
  currency: 'USD',
  capability: 'manual',
  status: 'manual',
  note: 'Synthetic evidence only',
};
const cost = {
  id: 'bill-v1',
  source_id: source.id,
  logical_key: 'invoice-line',
  revision: 1,
  provider: source.provider,
  resource: 'database',
  feature: 'serving',
  period_start: '2026-10-01T00:00:00Z',
  period_end: '2026-11-01T00:00:00Z',
  net: '3',
  before_benefits: '5',
  currency: 'USD',
  destination: 'overhead',
  subject: '',
  content_id: '',
  method: 'reviewed_provider_evidence',
  metric: 'requests',
  allocable_bps: 0,
  reconciled: false,
  reason: 'Synthetic provider evidence',
  created_at: now,
  actor: 'fixture',
};
const row = (key: string, total: string | null) => ({
  key,
  total,
  direct: total,
  shared: total == null ? null : '0',
  reconciled: false,
});
async function install(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  role = 'admin'
) {
  const state = {
    unavailable: false,
    aiUnavailable: false,
    costPosts: [] as Record<string, unknown>[],
    sourcePosts: [] as Record<string, unknown>[],
  };
  await context.addCookies([
    { name: 'console_access_token', value: 'fixture-only', url: baseURL },
  ]);
  await page.route('**/api/**', async (route) => {
    const u = new URL(route.request().url()),
      path = u.pathname;
    const meta = {
      revision: 'r1',
      as_of: now,
      from: u.searchParams.get('from') ?? '2026-10-01',
      to: u.searchParams.get('to') ?? '2026-11-01',
      coverage: 'partial',
      currency: 'USD',
      environment: 'qualification fixture',
    };
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          user_id: 'operator',
          role,
          roles: [role],
          is_admin: role === 'admin',
          permissions: role === 'admin' ? ['*:*'] : ['content:read'],
        },
      });
    if (path.endsWith('/ai-spend/status'))
      return route.fulfill(
        state.aiUnavailable
          ? { status: 503, json: { error: 'AI owner unavailable' } }
          : { json: fixture() }
      );
    if (path.endsWith('/economics-directory'))
      return route.fulfill({
        json: {
          users: [
            {
              id: account,
              username: 'Reader One',
              email: 'reader@example.test',
            },
          ],
          has_more: false,
        },
      });
    if (path.endsWith('/economics/accounts'))
      return route.fulfill(
        state.unavailable
          ? {
              status: 503,
              json: {
                error: 'Account reports await IAM lifecycle synchronization',
              },
            }
          : {
              json: {
                ...meta,
                accounts: [
                  {
                    account_id: account,
                    driver: 'database',
                    direct: '1',
                    shared: '2',
                    total: '3',
                    requests: 42,
                    errors: 1,
                    reconciled: false,
                  },
                ],
                total: 1,
                offset: 0,
                next_cursor: null,
              },
            }
      );
    if (path.endsWith(`/economics/accounts/${account}`))
      return route.fulfill({
        json: {
          ...meta,
          account_id: account,
          total: { ...row('total', '3'), direct: '1', shared: '2' },
          resources: [
            { ...row('database', '3'), methods: 'calibrated_resource_profile' },
            row('delivery', null),
          ],
          activities: [row('news', '3')],
          trend: [row('2026-10-15', '5'), row('2026-10-16', '-2')],
          usage: [{ operation: 'news_page', unit: 'requests', value: 42 }],
          requested_work: [
            {
              provider: 'fixture',
              resource: 'ai',
              feature: 'transcription',
              content_id: 'content',
              amount: '9',
              benefit: 'shared_content',
              occurred_at: now,
            },
          ],
          comparisons: { reason: 'Insufficient comparable usage' },
          efficiency_metrics: [],
          note: 'Shared allocations do not establish savings from removing this account',
        },
      });
    if (path.endsWith('/economics/overview'))
      return route.fulfill({
        json: {
          ...meta,
          total: row('total', '3'),
          resources: [row('database', '3')],
          destinations: [row('accounts', '3')],
          trend: [],
          distribution: {
            count: 1,
            mean: '3',
            median: '3',
            p90: null,
            p95: null,
          },
          distribution_note: 'Observed accounts only',
        },
      });
    if (path.endsWith('/economics/policy'))
      return route.fulfill({
        json: {
          collection_enabled: true,
          reports_enabled: true,
          allocation_enabled: false,
          imports_enabled: false,
        },
      });
    if (path.endsWith('/economics/costs')) {
      if (route.request().method() === 'POST') {
        state.costPosts.push(route.request().postDataJSON());
        return route.fulfill({
          status: 201,
          json: { ...cost, ...route.request().postDataJSON(), revision: 2 },
        });
      }
      return route.fulfill({ json: { ...meta, costs: [cost] } });
    }
    if (path.endsWith('/economics/sources')) {
      if (route.request().method() === 'POST') {
        state.sourcePosts.push(route.request().postDataJSON());
        return route.fulfill({
          status: 201,
          json: { ...source, ...route.request().postDataJSON() },
        });
      }
      return route.fulfill({ json: { sources: [source] } });
    }
    if (path.endsWith('/ai-spend/invoices'))
      return route.fulfill({ json: { invoices: [] } });
    if (path.endsWith('/ai-spend/price-book'))
      return route.fulfill({ json: { prices: [] } });
    return route.fulfill({ json: {} });
  });
  return state;
}

test('account investigation keeps resources and requested work distinct', async ({
  page,
  context,
  baseURL,
}) => {
  await install(page, context, baseURL!);
  await page.goto('/platform/economics');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page.getByText('Reader One', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Database', exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: new RegExp(`Reader One.*${account}`) })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('cell', { name: /42 requests.*API workload/ })
  ).toBeVisible();
  await expect(
    dialog.getByText('API workload proxy; query count unavailable')
  ).toBeVisible();
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: 'test-results/platform-user-economics-desktop.png',
  });
  await dialog.getByText('Activities, efficiency & evidence').click();
  await expect(
    dialog.getByText(/separate from the account total/)
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search name, email or account ID' })
    .fill('Reader');
  await expect(page.getByText('Reader One', { exact: true })).toBeVisible();
});
test('narrow account detail remains usable and refunds retain their sign', async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await install(page, context, baseURL!);
  await page.goto('/platform/economics');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(account) }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: 'test-results/platform-user-economics-narrow-resources.png',
  });
  await dialog.getByText('View trend values').click();
  await expect(dialog.getByText('-$2.00', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('Refunds and negative corrections appear below zero.')
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/platform-user-economics-mobile.png',
    fullPage: true,
  });
});
test('lifecycle unavailability is an error rather than zero account cost', async ({
  page,
  context,
  baseURL,
}) => {
  const state = await install(page, context, baseURL!);
  state.unavailable = true;
  await page.goto('/platform/economics');
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'lifecycle synchronization' })
  ).toBeVisible();
  await expect(
    page.getByText('No observed accounts in this period')
  ).not.toBeVisible();
});
test('manual correction preserves the source line and decimal value', async ({
  page,
  context,
  baseURL,
}) => {
  const state = await install(page, context, baseURL!);
  await page.goto('/platform/economics');
  await page.getByRole('button', { name: 'Billing', exact: true }).click();
  await page.getByText('Reason & method', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Correct this source line', exact: true })
    .click();
  await page
    .getByLabel('Net charge (USD)', { exact: true })
    .fill('-2.000000000001');
  await page
    .getByLabel('Evidence and correction reason', { exact: true })
    .fill('Reviewed correction fixture');
  await page
    .getByRole('button', { name: 'Append correction', exact: true })
    .click();
  await expect.poll(() => state.costPosts.length).toBe(1);
  expect(state.costPosts[0]).toMatchObject({
    source_id: source.id,
    logical_key: 'invoice-line',
    net: '-2.000000000001',
    subject: '',
    content_id: '',
    reason: 'Reviewed correction fixture',
  });
});
test('new platform views remain available when AI owner status fails', async ({
  page,
  context,
  baseURL,
}) => {
  const state = await install(page, context, baseURL!);
  state.aiUnavailable = true;
  await page.goto('/platform/economics');
  await expect(
    page.getByRole('button', { name: 'Retry AI evidence' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Users', exact: true }).click();
  await expect(page.getByText('Reader One', { exact: true })).toBeVisible();
});
test('content readers retain AI visibility without account economics access', async ({
  page,
  context,
  baseURL,
}) => {
  let accountRequests = 0;
  await install(page, context, baseURL!, 'viewer');
  page.on('request', (r) => {
    if (r.url().includes('/economics/accounts')) accountRequests++;
  });
  await page.goto('/platform/economics');
  await expect(
    page.getByRole('heading', { name: 'Economics', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Users', exact: true })
  ).not.toBeVisible();
  expect(accountRequests).toBe(0);
});
