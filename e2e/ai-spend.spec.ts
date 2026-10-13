import { test, expect } from '@playwright/test';

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

test.describe('AI spend cockpit', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'console_access_token', value: 'fixture-only', url: baseURL! },
    ]);
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            user_id: 'human',
            role: 'admin',
            roles: ['admin'],
            is_admin: true,
            permissions: ['*:*'],
          },
        });
      if (path.endsWith('/ai-spend/status'))
        return route.fulfill({ json: fixture() });
      if (path.endsWith('/ai-spend/rollups'))
        return route.fulfill({
          json: {
            rollups: [
              {
                id: 1,
                day: now,
                spend_class: 'llm',
                operation: 'digest',
                provider: 'test',
                model: 'test',
                events: 1,
                cost_usd: 0.01,
              },
            ],
            total: 510,
          },
        });
      if (path.endsWith('/ai-spend/price-book'))
        return route.fulfill({ json: { prices: [] } });
      if (path.endsWith('/ai-spend/invoices'))
        return route.fulfill({ json: { invoices: [] } });
      if (path.endsWith('/ai-spend/episodes'))
        return route.fulfill({ json: { episodes: [] } });
      if (path.endsWith('/ai-spend/events'))
        return route.fulfill({ json: { events: [], total: 0 } });
      if (path.endsWith('/ai-spend/runs') || path.endsWith('/ai-spend/by-run'))
        return route.fulfill({ json: { runs: [] } });
      return route.fulfill({ json: {} });
    });
  });
  test('headline uses exact totals independently of paged detail', async ({
    page,
  }) => {
    await page.goto('/platform/economics');
    await expect(page.getByText('$123.456', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Measured cache savings', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Estimated cache savings', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Monitoring spend. Limits are not enforced.', {
        exact: true,
      })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Activity', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/of 510/)).toBeVisible();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByText('$123.456', { exact: true })).toBeVisible();
  });
  test('partial cap edit preserves server accounting fields and pause resume preserves disabled', async ({
    page,
  }) => {
    const writes: object[] = [];
    await page.route('**/ai-spend/budgets', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: {} });
    });
    await page.route('**/ai-spend/policy', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: {} });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await page
      .getByText('Schedule, retention & detection settings', { exact: true })
      .click();
    await expect(page.getByLabel('Cadence (minutes)')).toHaveValue('7');
    await page
      .getByRole('button', { name: 'Edit Language model budget' })
      .click();
    await page.getByLabel('class:llm cap').fill('20');
    await page
      .getByRole('button', { name: 'Save budget', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Budget saved');
    expect(writes[0]).toEqual({
      scope: 'class:llm',
      cap_usd: 20,
      warn_pct: 70,
      hard_pct: 100,
    });
    await page
      .getByRole('button', { name: 'Pause governor for 1 hour' })
      .click();
    await expect(page.getByRole('status')).toContainText('Schedule updated');
    expect(writes[1]).toHaveProperty('paused_until');
    expect(writes[1]).not.toHaveProperty('enabled');
  });
  test('failed accounting run never announces completion', async ({ page }) => {
    await page.route('**/ai-spend/run', (route) =>
      route.fulfill({
        status: 500,
        json: { message: 'Ledger insert failed', run: { status: 'failed' } },
      })
    );
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Refresh ledger' }).click();
    await expect(page.getByRole('alert').first()).toContainText('Ledger');
    await expect(
      page.getByText('Ledger refreshed', { exact: true })
    ).toHaveCount(0);
  });
  test('readers investigate while controls stay disabled', async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          user_id: 'reader',
          role: 'viewer',
          roles: ['viewer'],
          permissions: ['content:read'],
        },
      })
    );
    await page.goto('/platform/economics');
    await expect(page.getByText('Your access is read only.')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh ledger' })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Enable governance' })
    ).toBeDisabled();
  });
  test('human override previews confirms and sends only the matching workflow grant', async ({
    page,
  }) => {
    const writes: object[] = [];
    await page.route('**/ai-spend/override/preview?**', (route) =>
      route.fulfill({
        json: { allowed: false, reason: 'budget_capped', remaining_usd: 0 },
      })
    );
    await page.route('**/ai-spend/override/confirm', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: { id: 'grant-fixture', expires_at: now } });
    });
    await page.route('**/stories/summary-batch', async (route) => {
      expect(route.request().headers()['x-ai-spend-override']).toBe(
        'grant-fixture'
      );
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: { processed: 1 } });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await page
      .getByText('Run a workflow with human confirmation', { exact: true })
      .click();
    await page
      .getByLabel('Override workflow')
      .selectOption('manual_story_digest');
    await page.getByRole('button', { name: 'Preview allowance' }).click();
    await expect(page.getByText(/Stopped · Budget reached/)).toBeVisible();
    await page
      .getByRole('button', { name: 'Confirm paid LLM override' })
      .click();
    expect(writes[0]).toEqual({
      trigger_source: 'manual_story_digest',
      confirm: true,
    });
    await page
      .getByRole('button', { name: 'Execute confirmed workflow' })
      .click();
    await expect(page.getByRole('status')).toContainText('Workflow completed');
    expect(writes[1]).toEqual({ limit: 1 });
  });
  test('unavailable reads expose retry and preserve the error', async ({
    page,
  }) => {
    await page.route('**/ai-spend/status?**', (route) =>
      route.fulfill({ status: 503, json: { message: 'ledger unavailable' } })
    );
    await page.goto('/platform/economics');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Could not load AI spend' })
    ).toContainText('Could not load AI spend', { timeout: 15000 });
    await expect(
      page.getByRole('button', { name: 'Retry', exact: true })
    ).toBeVisible();
  });

  test('reader reconciles a selected month and provider without an invoice', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          user_id: 'reader',
          role: 'viewer',
          roles: ['viewer'],
          permissions: ['content:read'],
        },
      })
    );
    const reads: URL[] = [];
    await page.route('**/ai-spend/status?**', async (route) => {
      const url = new URL(route.request().url());
      reads.push(url);
      const data = fixture();
      if (
        url.searchParams.get('provider') === 'deepseek' &&
        url.searchParams.get('from') === '2026-09-01'
      )
        data.totals.cost_usd = 7;
      await route.fulfill({ json: data });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Billing', exact: true }).click();
    await page.getByLabel('Provider', { exact: true }).last().fill('deepseek');
    await page.getByLabel('Calendar month').fill('2026-09');
    await expect(page.getByLabel('Calendar-month ledger')).toContainText(
      'Month ledger: $7.00'
    );
    await page.getByText('Record a provider invoice', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Save invoice' })
    ).toBeDisabled();
    expect(
      reads.some(
        (url) =>
          url.searchParams.get('from') === '2026-09-01' &&
          url.searchParams.get('to') === '2026-10-01' &&
          url.searchParams.get('provider') === 'deepseek'
      )
    ).toBeTruthy();
  });

  test('policy knobs compute watches and permanent actor filter are actionable', async ({
    page,
  }) => {
    const writes: object[] = [];
    const filters: URL[] = [];
    await page.route('**/ai-spend/policy', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: {} });
    });
    await page.route('**/ai-spend/rollups?**', async (route) => {
      filters.push(new URL(route.request().url()));
      await route.fulfill({ json: { rollups: [], total: 0 } });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('Human actor ID').fill('reviewer');
    await page
      .getByRole('button', { name: 'Apply filters', exact: true })
      .click();
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await page
      .getByText('Schedule, retention & detection settings', { exact: true })
      .click();
    await page.getByLabel('Raw retention (days)').fill('120');
    await page.getByLabel('Spike multiplier').fill('5');
    await page
      .getByRole('button', { name: 'Save schedule', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Schedule saved');
    expect(writes[0]).toMatchObject({
      retention_days: 120,
      spike_multiplier: 5,
    });
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page
      .getByRole('button', { name: 'Efficiency & compute', exact: true })
      .click();
    await page
      .getByText('Edit compute watch thresholds', { exact: true })
      .click();
    await page.getByLabel('embedding daily watch threshold').fill('200');
    await page.getByRole('button', { name: 'Save compute watches' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Compute watches saved'
    );
    expect(writes[1]).toEqual({ compute_watch_limits: { embedding: 200 } });
    expect(
      filters.some(
        (url) => url.searchParams.get('human_actor_id') === 'reviewer'
      )
    ).toBeTruthy();
  });

  test('all cockpit sections fit the viewport and run history filters reach CMS', async ({
    page,
  }) => {
    const reads: URL[] = [];
    await page.route('**/ai-spend/runs?**', async (route) => {
      reads.push(new URL(route.request().url()));
      await route.fulfill({ json: { runs: [], total: 0 } });
    });
    await page.goto('/platform/economics');
    for (const name of [
      'Overview',
      'Budgets',
      'Activity',
      'Efficiency & compute',
      'Billing',
      'Attention',
      'Diagnostics',
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBeTruthy();
    }
    await page.getByLabel('Run status').selectOption('failed');
    await expect(
      page.getByRole('button', { name: 'Next runs' })
    ).toBeDisabled();
    await expect
      .poll(() =>
        reads.some(
          (url) =>
            url.searchParams.get('status') === 'failed' &&
            url.searchParams.get('limit') === '50'
        )
      )
      .toBeTruthy();
  });

  test('run spend inspection paginates retained evidence while exact totals stay fixed', async ({
    page,
  }) => {
    const offsets: string[] = [];
    await page.route('**/ai-spend/by-run?**', (route) =>
      route.fulfill({
        json: {
          runs: [
            {
              trigger_source: 'operator',
              system_run_id: 'fixture-run',
              cost_usd: 99,
              events: 101,
            },
          ],
        },
      })
    );
    await page.route('**/ai-spend/by-run/fixture-run?**', async (route) => {
      const offset = new URL(route.request().url()).searchParams.get('offset')!;
      offsets.push(offset);
      await route.fulfill({
        json: {
          system_run_id: 'fixture-run',
          totals: { cost_usd: 99, events: 101 },
          rollup_total: 101,
          human_total: 1,
          offset: Number(offset),
          rollups: [{ human_actor_id: 'human', operation: 'operator_reason' }],
          human_confirmations: [
            {
              human_actor_id: 'human',
              admission_snapshot: { reason: 'budget_capped' },
            },
          ],
          owner_references: [
            {
              status: 'matched',
              owner_url: '/platform/operator',
              metadata: { state: 'completed' },
            },
          ],
        },
      });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page
      .getByRole('button', { name: 'Inspect run', exact: true })
      .click();
    await expect(page.getByText('101 evidence rows · Offset 0')).toBeVisible();
    await page.getByRole('button', { name: 'Next run evidence' }).click();
    await expect(
      page.getByText('101 evidence rows · Offset 100')
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Next run evidence' })
    ).toBeDisabled();
    await expect(
      page.getByRole('dialog').getByText('$99.00', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open owning workflow' })
    ).toHaveAttribute('href', '/platform/operator');
    await expect(
      page.getByText('Human confirmations', { exact: true })
    ).toBeVisible();
    expect(offsets).toEqual(['0', '100']);
  });
  test('cost drivers drill into activity and filters can be cleared', async ({
    page,
  }) => {
    const reads: URL[] = [];
    await page.route('**/ai-spend/status?**', async (route) => {
      reads.push(new URL(route.request().url()));
      await route.fulfill({
        json: {
          ...fixture(),
          breakdown: {
            ...fixture().breakdown,
            trigger_source: [{ key: 'operator', cost_usd: 10, events: 5 }],
          },
        },
      });
    });
    await page.goto('/platform/economics');
    await page
      .getByRole('button')
      .filter({ hasText: 'Wahb Operator' })
      .last()
      .click();
    await expect(
      page.getByRole('button', { name: 'Activity', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(() =>
        reads.some((u) => u.searchParams.get('trigger_source') === 'operator')
      )
      .toBeTruthy();
    await expect(
      page.getByText('Workflow: Wahb Operator', { exact: true })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Clear filters', exact: true })
      .click();
    await expect(
      page.getByText('Workflow: Wahb Operator', { exact: true })
    ).toHaveCount(0);
    // Returning to the initial filter reuses its fresh query-cache entry.
    await expect(
      page.getByRole('button', { name: 'Filters', exact: true })
    ).toBeVisible();
    expect(reads[0].searchParams.get('trigger_source') || '').toBe('');
  });

  test('filter drafts apply once and dismissing discards unsaved edits', async ({
    page,
  }) => {
    const reads: URL[] = [];
    await page.route('**/ai-spend/status?**', async (route) => {
      reads.push(new URL(route.request().url()));
      await route.fulfill({ json: fixture() });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByLabel('Model', { exact: true }).fill('draft-model');
    expect(
      reads.some((u) => u.searchParams.get('model') === 'draft-model')
    ).toBe(false);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await expect(page.getByLabel('Model', { exact: true })).toHaveValue('');
    await page.getByLabel('Model', { exact: true }).fill('reviewed-model');
    await page
      .getByRole('button', { name: 'Apply filters', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .poll(() =>
        reads.some((u) => u.searchParams.get('model') === 'reviewed-model')
      )
      .toBeTruthy();
  });

  test('inclusive custom dates reach CMS as an exclusive end and invalid ranges stay reviewable', async ({
    page,
  }) => {
    const reads: URL[] = [];
    await page.route('**/ai-spend/status?**', async (route) => {
      reads.push(new URL(route.request().url()));
      await route.fulfill({ json: fixture() });
    });
    await page.goto('/platform/economics');
    await page.getByLabel('Report period').selectOption('custom');
    await page.getByLabel('From (UTC)', { exact: true }).fill('2025-01-01');
    await page.getByLabel('Through (UTC)', { exact: true }).fill('2026-09-07');
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'at most 365 days'
    );
    await page.getByLabel('From (UTC)', { exact: true }).fill('2026-09-01');
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .poll(() =>
        reads.some(
          (u) =>
            u.searchParams.get('from') === '2026-09-01' &&
            u.searchParams.get('to') === '2026-09-08'
        )
      )
      .toBeTruthy();
    await expect(page.getByText(/2026-09-01 – 2026-09-07/)).toBeVisible();
    await page
      .getByRole('button', { name: 'Change report dates', exact: true })
      .click();
    await expect(page.getByLabel('From (UTC)', { exact: true })).toHaveValue(
      '2026-09-01'
    );
    await expect(page.getByLabel('Through (UTC)', { exact: true })).toHaveValue(
      '2026-09-07'
    );
    await page.getByLabel('Through (UTC)', { exact: true }).fill('2026-09-08');
    await page
      .getByRole('button', { name: 'Apply dates', exact: true })
      .click();
    await expect
      .poll(() => reads.some((u) => u.searchParams.get('to') === '2026-09-09'))
      .toBeTruthy();
  });

  test('failed budget saves keep edits and errors inside the dialog', async ({
    page,
  }) => {
    const writes: Record<string, unknown>[] = [];
    await page.route('**/ai-spend/budgets', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill(
        writes.length === 1
          ? { status: 503, json: { message: 'Budget store unavailable' } }
          : { json: {} }
      );
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await page
      .getByRole('button', { name: 'Edit Language model budget' })
      .click();
    await page.getByLabel('class:llm cap').fill('0');
    await page
      .getByRole('button', { name: 'Save budget', exact: true })
      .click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Budget store unavailable'
    );
    await expect(page.getByLabel('class:llm cap')).toHaveValue('0');
    await page
      .getByRole('button', { name: 'Save budget', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes[1]).toMatchObject({ cap_usd: 0, scope: 'class:llm' });
    await page
      .getByRole('button', { name: 'Edit Language model budget' })
      .click();
    await page.getByLabel('class:llm cap').fill('');
    await page
      .getByRole('button', { name: 'Save budget', exact: true })
      .click();
    await expect.poll(() => writes.length).toBe(3);
    expect(writes[2]).toMatchObject({ cap_usd: null, scope: 'class:llm' });
  });

  test('issue reviews keep independent reasons and resolved history is optional', async ({
    page,
  }) => {
    const writes: Record<string, unknown>[] = [];
    const episodes = [
      {
        id: 11,
        kind: 'spike',
        scope: 'system:operator',
        status: 'open',
        first_seen_at: now,
        last_seen_at: now,
        evidence: { today_usd: 4, median_14d_usd: 1 },
      },
      {
        id: 12,
        kind: 'stt_drift',
        scope: 'class:stt_api',
        status: 'open',
        first_seen_at: now,
        last_seen_at: now,
      },
      {
        id: 13,
        kind: 'metering_loss',
        scope: 'ledger',
        status: 'resolved',
        first_seen_at: now,
        last_seen_at: now,
        close_reason: 'Delivery repaired',
      },
    ];
    await page.route('**/ai-spend/episodes', (route) =>
      route.fulfill({ json: { episodes } })
    );
    await page.route('**/ai-spend/episodes/*/close', async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: {} });
    });
    await page.goto('/platform/economics');
    await page.getByRole('button', { name: 'Attention', exact: true }).click();
    const spike = page
      .locator('article')
      .filter({ hasText: 'Unusual spend increase' });
    const stt = page
      .locator('article')
      .filter({ hasText: 'Transcription ledger mismatch' });
    await spike.getByText('Record a review outcome', { exact: true }).click();
    await stt.getByText('Record a review outcome', { exact: true }).click();
    await spike.getByLabel('Closure reason').fill('Reviewed the operator run');
    await expect(stt.getByLabel('Closure reason')).toHaveValue('');
    await expect(
      stt.getByRole('button', { name: 'Close after review' })
    ).toBeDisabled();
    await spike.getByRole('button', { name: 'Close after review' }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      reason: 'Reviewed the operator run',
      false_positive: false,
    });
    await expect(
      page.getByText('Review outcome: Delivery repaired')
    ).toHaveCount(0);
    await page.getByLabel('Include resolved history').check();
    await expect(
      page.getByText('Review outcome: Delivery repaired')
    ).toBeVisible();
  });

  test('empty and unavailable evidence has useful guidance without invented allowance', async ({
    page,
  }) => {
    await page.route('**/ai-spend/status?**', (route) =>
      route.fulfill({
        json: {
          ...fixture(),
          policy: { ...fixture().policy, enabled: true },
          allowance: null,
          daily_by_class: [],
          breakdown: { day: [] },
          evidence: { ...fixture().evidence, ledger_health: 'no_evidence' },
        },
      })
    );
    await page.goto('/platform/economics');
    await expect(
      page.getByText('No spend recorded in this period', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Check spend evidence', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText('Autonomous LLM work is allowed', { exact: true })
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Review evidence', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Accounting diagnostics', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Spend evidence quality', exact: true })
    ).toBeVisible();
  });
  test('null CMS collections render useful empty states in every workspace', async ({
    page,
  }) => {
    await page.route('**/ai-spend/status?**', (route) =>
      route.fulfill({
        json: {
          ...fixture(),
          budgets: null,
          episodes: null,
          compute_watch: null,
          daily_by_class: null,
          units: null,
          item_economics: null,
          coverage: null,
          breakdown: {
            day: null,
            spend_class: null,
            trigger_source: null,
            operation: null,
          },
          evidence: { ...fixture().evidence, emitters: null },
        },
      })
    );
    for (const key of [
      'invoices',
      'price-book',
      'episodes',
      'by-run',
      'events',
      'runs',
      'rollups',
    ]) {
      await page.route(`**/ai-spend/${key}*`, (route) =>
        route.fulfill({
          json: {
            invoices: null,
            prices: null,
            episodes: null,
            runs: null,
            events: null,
            rollups: null,
            total: 0,
          },
        })
      );
    }
    await page.goto('/platform/economics');
    await expect(page.getByText('No limit set', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Billing', exact: true }).click();
    await expect(
      page.getByText('No invoices recorded yet.', { exact: false })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Review shared price book' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Versioned price book', exact: true })
    ).toBeVisible();
    for (const name of [
      'Activity',
      'Efficiency & compute',
      'Attention',
      'Diagnostics',
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(
        page.getByText('Something went wrong', { exact: true })
      ).toHaveCount(0);
    }
    await expect(
      page.getByText('No delivery health received.', { exact: true })
    ).toBeVisible();
  });
  test('advisory scope warnings remain visible independently of LLM admission', async ({
    page,
  }) => {
    await page.route('**/ai-spend/status?**', (route) =>
      route.fulfill({
        json: {
          ...fixture(),
          headline: 'bounded_stop',
          policy: { ...fixture().policy, enabled: true },
          allowance: { allowed: true, reason: 'within_budget' },
          budget_verdicts: {
            'class:llm': { verdict: 'within' },
            platform: { verdict: 'bounded_stop' },
          },
        },
      })
    );
    await page.goto('/platform/economics');
    await expect(
      page.getByText('Autonomous LLM work is allowed', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(/All AI activity: Limit reached/)
    ).toContainText('Advisory limits raise attention; they do not stop work.');
    await expect(
      page.getByText('New autonomous LLM work is stopped', { exact: true })
    ).toHaveCount(0);
  });
});
