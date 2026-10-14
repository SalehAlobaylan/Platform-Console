import { test, expect } from '@playwright/test';

const now = new Date().toISOString();
const decisionHour = new Date(Date.now() - 3600000);
decisionHour.setUTCMinutes(0, 0, 0);
const bucket = decisionHour.toISOString();
const sli = (metric: string, title: string, status = 'ok') => ({
  metric,
  label: title,
  status,
  required: true,
  confirmed: status === 'breach',
  value: ['insufficient', 'not_exercised'].includes(status)
    ? 0
    : status === 'breach'
      ? 0.8
      : 0.998,
  target: 0.99,
  numerator: ['insufficient', 'not_exercised'].includes(status)
    ? 0
    : status === 'breach'
      ? 800
      : 998,
  denominator: ['insufficient', 'not_exercised'].includes(status) ? 0 : 1000,
  population: 'eligible journey outcomes',
  active_sessions: 800,
  affected_sessions: status === 'breach' ? 160 : 2,
  latency_samples: 900,
  p75_ms: 800,
  p75_budget_ms: 2000,
  critical: false,
});
const policy = {
  tenant_id: 'default',
  enabled_clients: 'web',
  ingest_enabled: true,
  evaluation_enabled: false,
  enabled_surfaces: 'pods,news',
  min_sample_floor: 50,
  latency_sample_floor: 50,
  confirm_windows: 2,
  resolve_windows: 3,
  telemetry_freshness_minutes: 15,
  raw_retention_days: 7,
  minute_rollup_retention_hours: 48,
  hour_rollup_retention_days: 400,
  max_release_cohorts: 4,
  thresholds: {},
  paused_until: null,
  last_evaluated_bucket: now,
  last_minute_bucket: now,
  updated_at: now,
};
const incident = (id: string, affected: number) => ({
  id,
  metric_key: 'playback_start_success',
  surface: 'pods',
  cohort_dim: 'browser',
  cohort_val: 'safari-18',
  severity: 'degraded',
  status: 'open',
  summary: id === 'high' ? 'Safari startup failure' : 'Minor startup failure',
  likely_owner: 'wahb_platform',
  recommendation:
    id === 'high' ? 'Compare Safari release evidence.' : 'Inspect playback.',
  investigation_path: '/platform/real-experience',
  confirmed_at: now,
  first_seen_at: now,
  last_seen_at: now,
  last_evaluated_bucket: now,
  violation_streak: 2,
  clean_streak: 0,
  evidence: {
    affected_sessions: affected,
    active_sessions: 1000,
    numerator: 800,
    denominator: 1000,
    population: 'eligible journey outcomes',
    window_start: bucket,
  },
});

test.describe('Real Experience fixture cockpit (all requests isolated)', () => {
  let newsVerdict = 'insufficient_data';
  let incidentsUnavailable = false;
  let metricsUnavailable = false;
  let readonly = false;
  let metricsEmpty = false;
  let lowVolume = false;
  let reads: string[];
  let rows: ReturnType<typeof incident>[];
  let nativeRows: ReturnType<typeof incident>[];
  let writes: { path: string; body: Record<string, unknown> }[];
  let currentPolicy: typeof policy;
  test.beforeEach(async ({ page, context, baseURL }) => {
    newsVerdict = 'insufficient_data';
    incidentsUnavailable = false;
    metricsUnavailable = false;
    readonly = false;
    metricsEmpty = false;
    lowVolume = false;
    rows = [incident('low', 5), incident('high', 500)];
    nativeRows = [];
    writes = [];
    reads = [];
    currentPolicy = { ...policy };
    await context.addCookies([
      { name: 'console_access_token', value: 'fixture-only', url: baseURL! },
    ]);
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      if (request.method() === 'GET') reads.push(path);
      const client = url.searchParams.get('client_platform') || 'web';
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            user_id: 'human',
            role: readonly ? 'viewer' : 'admin',
            roles: readonly ? ['viewer'] : ['admin'],
            is_admin: !readonly,
            permissions: readonly
              ? ['feed:read']
              : ['feed:manage', 'feed:read'],
          },
        });
      if (request.method() !== 'GET') {
        const body = request.postDataJSON() || {};
        writes.push({ path, body });
        if (path.endsWith('/experience/policy'))
          currentPolicy = { ...currentPolicy, ...body };
        if (path.endsWith('/close'))
          rows = rows.filter((row) => !path.includes('/' + row.id + '/'));
        return route.fulfill({ json: { data: body } });
      }
      let data: unknown = [];
      if (path.endsWith('/experience/status'))
        data = {
          policy: currentPolicy,
          latest_run: null,
          telemetry_fresh: true,
          open_incidents: rows.length,
        };
      if (path.endsWith('/experience/metrics') && metricsUnavailable)
        return route.fulfill({
          status: 503,
          json: { error: 'Metrics unavailable' },
        });
      if (path.endsWith('/experience/metrics'))
        data = {
          bucket,
          client_enabled: currentPolicy.enabled_clients
            .split(',')
            .includes(client),
          telemetry_fresh: client === 'web',
          surfaces: {
            pods: {
              verdict:
                metricsEmpty || client !== 'web'
                  ? 'insufficient_data'
                  : 'degraded',
              slis: metricsEmpty
                ? []
                : [
                    lowVolume
                      ? {
                          ...sli(
                            'feed_render_success',
                            'Feed loads',
                            'insufficient'
                          ),
                          numerator: 8,
                          denominator: 10,
                        }
                      : sli('feed_render_success', 'Feed loads'),
                    sli(
                      'playback_start_success',
                      'Playback starts',
                      client === 'web' ? 'breach' : 'insufficient'
                    ),
                    {
                      ...sli('rebuffer_ratio', 'Rebuffer time'),
                      required: false,
                      value: 0.01,
                      numerator: 10000,
                      denominator: 1000000,
                      target: 0.02,
                      population: 'observed listening milliseconds',
                      p75_budget_ms: 0,
                    },
                    { ...sli('seek_success', 'Seeking'), required: false },
                    {
                      ...sli('handoff_success', 'Feed handoff'),
                      required: false,
                    },
                  ],
            },
            news: {
              verdict: newsVerdict,
              slis: metricsEmpty
                ? []
                : [
                    sli('feed_render_success', 'Feed loads', 'insufficient'),
                    sli(
                      'article_ready_success',
                      'Reader opens',
                      'insufficient'
                    ),
                    sli('interaction_success', 'Interactions', 'not_exercised'),
                  ],
            },
          },
        };
      if (path.endsWith('/experience/incidents')) {
        if (incidentsUnavailable)
          return route.fulfill({
            status: 503,
            json: { error: 'Evidence unavailable' },
          });
        data = client === 'web' ? rows : client === 'ios' ? nativeRows : [];
      }
      if (path.includes('/experience/evidence/incident/'))
        return route.fulfill({
          json: {
            data: {
              incident: [...rows, ...nativeRows].find((row) =>
                path.endsWith('/' + row.id)
              ),
              actions: [],
            },
          },
        });
      if (path.includes('/experience/evidence/'))
        data = {
          rows: [],
          next_before_id: 0,
          release_comparison: {
            qualified: false,
            reason: 'Sparse releases.',
            metrics: [],
          },
        };
      return route.fulfill({ json: { data } });
    });
  });
  test('mixed coverage withholds green health and prioritizes confirmed impact', async ({
    page,
  }, info) => {
    await page.goto('/platform/real-experience');
    await expect(
      page.getByText(
        'Confirmed web experience degradation needs investigation.'
      )
    ).toBeVisible();
    const recommendation = page.getByRole('region', {
      name: 'Recommended next step',
      exact: true,
    });
    await expect(recommendation).toContainText(
      'Compare Safari release evidence.'
    );
    await expect(
      page.getByRole('button', { name: 'Web preview', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    if (
      info.project.name === 'chromium' ||
      info.project.name === 'Mobile Safari'
    )
      await page.screenshot({
        path: info.outputPath('rux-cockpit.png'),
        fullPage: true,
      });
    await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
    await page.getByRole('tab', { name: 'Releases', exact: true }).click();
    await expect(
      page.getByText(/Insufficient comparable evidence/)
    ).toBeVisible();
    if (
      info.project.name === 'chromium' ||
      info.project.name === 'Mobile Safari'
    )
      await page.screenshot({
        path: info.outputPath('rux-release-evidence.png'),
      });
    expect(writes).toHaveLength(0);
  });
  test('an unavailable incident read cannot claim no open incidents', async ({
    page,
  }) => {
    incidentsUnavailable = true;
    await page.goto('/platform/real-experience');
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Evidence unavailable' })
        .first()
    ).toBeVisible();
    await expect(
      page.getByText('No open incidents in the current evidence.')
    ).toHaveCount(0);
  });
  test('human closure requires reason and notes and refetches persisted state', async ({
    page,
  }) => {
    await page.goto('/platform/real-experience');
    await page
      .getByRole('button', { name: 'Safari startup failure', exact: false })
      .click();
    await page.getByText('Administrative decisions', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Close with reason' })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: 'Save reviewed exception' })
    ).toBeDisabled();
    await page
      .getByLabel('Notes', { exact: true })
      .fill('Owner verified the repair; awaiting separate clean recovery.');
    await page.getByRole('button', { name: 'Save reviewed exception' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes[0].body).toMatchObject({
      reason_class: 'resolved_externally',
      notes: 'Owner verified the repair; awaiting separate clean recovery.',
    });
    await expect(
      page.getByRole('button', { name: /Safari startup failure/ })
    ).toHaveCount(0);
  });
  test('suppression keeps the exact cohort and bounded expiry', async ({
    page,
  }) => {
    await page.goto('/platform/real-experience');
    await page
      .getByRole('button', { name: 'Safari startup failure', exact: false })
      .click();
    await page.getByText('Administrative decisions', { exact: true }).click();
    await page
      .getByRole('button', { name: 'Suppress exact scope' })
      .first()
      .click();
    await page.getByLabel('Expiry (minutes)').fill('90');
    await page
      .getByLabel('Notes', { exact: true })
      .fill('Expected fixture behavior for this browser only.');
    await page.getByRole('button', { name: 'Save reviewed exception' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes[0].body).toMatchObject({
      metric_key: 'playback_start_success',
      surface: 'pods',
      cohort_dim: 'browser',
      cohort_val: 'safari-18',
      ttl_minutes: 90,
    });
  });
  test('native OS suppression preserves the selected platform and exact cohort', async ({
    page,
  }) => {
    nativeRows = [
      {
        ...incident('native', 50),
        cohort_dim: 'os',
        cohort_val: '26',
        summary: 'Native startup failure',
        likely_owner: 'wahb_mobile',
      },
    ];
    await page.goto('/platform/real-experience');
    await page.getByRole('button', { name: 'iOS', exact: true }).click();
    await page
      .getByRole('button', { name: 'Native startup failure', exact: false })
      .click();
    await page.getByText('Administrative decisions', { exact: true }).click();
    await page.getByRole('button', { name: 'Suppress exact scope' }).click();
    await page
      .getByLabel('Notes', { exact: true })
      .fill('Verified iOS 26 build issue.');
    await page.getByRole('button', { name: 'Save reviewed exception' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes[0].body).toMatchObject({
      client_platform: 'ios',
      cohort_dim: 'os',
      cohort_val: '26',
      metric_key: 'playback_start_success',
    });
  });
  test('the selector isolates native evidence from healthy Web preview results', async ({
    page,
  }, testInfo) => {
    currentPolicy.enabled_clients = 'web,ios';
    await page.goto('/platform/real-experience');
    await page.getByRole('button', { name: 'iOS', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'iOS', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByText('Required native journeys lack sufficient evidence.')
    ).toBeVisible();
    await expect(
      page.getByText('Stale or absent', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Safari startup failure/ })
    ).toHaveCount(0);
    if (
      testInfo.project.name === 'chromium' ||
      testInfo.project.name === 'Mobile Safari'
    )
      await page.screenshot({
        path: testInfo.outputPath('rux-native-cockpit.png'),
      });
    await page.getByRole('button', { name: 'Android', exact: true }).click();
    await expect(
      page.getByText(/Collection is disabled for this platform/)
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Web preview', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: /Safari startup failure/ })
    ).toBeVisible();
    expect(writes).toHaveLength(0);
  });
  test('policy edits survive persisted refetch without advancing checkpoints', async ({
    page,
  }, info) => {
    await page.goto('/platform/real-experience');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page
      .getByRole('button', { name: 'Edit policy and thresholds' })
      .click();
    if (
      info.project.name === 'chromium' ||
      info.project.name === 'Mobile Safari'
    )
      await page.screenshot({ path: info.outputPath('rux-policy-editor.png') });
    await page.getByLabel('Rate sample floor', { exact: true }).fill('75');
    await page.getByRole('button', { name: 'Save policy' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Edit policy and thresholds' })
      .click();
    await expect(
      page.getByLabel('Rate sample floor', { exact: true })
    ).toHaveValue('75');
    expect(currentPolicy.last_evaluated_bucket).toBe(now);
    expect(currentPolicy.last_minute_bucket).toBe(now);
  });
  test('workspace navigation preserves client on reload and leaves controls out of overview', async ({
    page,
  }) => {
    await page.goto('/platform/real-experience');
    await expect(
      page.getByRole('button', { name: 'Edit policy and thresholds' })
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'iOS', exact: true }).click();
    await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'iOS', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('tab', { name: 'Evidence', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('No evidence in this range')).toBeVisible();
    await page.getByRole('tab', { name: 'Activity', exact: true }).click();
    await expect(page.getByText('No evaluations recorded')).toBeVisible();
    expect(writes).toHaveLength(0);
  });
  test('journey detail reveals independent evidence floors and can be used with the keyboard', async ({
    page,
  }) => {
    await page.goto('/platform/real-experience');
    const pods = page.getByRole('region', { name: 'Pods journeys' });
    const journey = pods.locator('details').filter({
      has: page.locator('summary').filter({ hasText: 'Playback starts' }),
    });
    const summary = journey.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(
      pods.getByText(/160 affected of 800 active tabs/)
    ).toBeVisible();
    await expect(
      journey.getByText(/Rate sample floor: 50 outcomes/)
    ).toBeVisible();
    await expect(
      journey.getByText(/900 latency samples \/ 50 required/)
    ).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(
      pods.getByText(/160 affected of 800 active tabs/)
    ).toBeHidden();
  });
  test('empty collection and failed metrics are explicit and never show healthy summary', async ({
    page,
  }) => {
    metricsEmpty = true;
    rows = [];
    await page.goto('/platform/real-experience');
    await expect(page.getByText('No journey measurements yet')).toHaveCount(2);
    await expect(
      page.getByRole('region', { name: 'Experience summary' })
    ).toContainText('More evidence needed');
    metricsUnavailable = true;
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Experience summary' })
    ).toContainText('Evidence unavailable');
    await expect(
      page.getByRole('region', { name: 'Pods journeys' })
    ).toContainText('Evidence incomplete');
    await expect(
      page.getByRole('region', { name: 'Experience summary' })
    ).not.toContainText('Healthy');
  });
  test('read-only operators can investigate but cannot change policy or incidents', async ({
    page,
  }) => {
    readonly = true;
    await page.goto('/platform/real-experience');
    await expect(
      page.getByRole('button', { name: 'Evaluate all clients' })
    ).toBeDisabled();
    await page.getByRole('button', { name: /Safari startup failure/ }).click();
    await page.getByText('Administrative decisions', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Close with reason' })
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Suppress exact scope' })
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Edit policy and thresholds' })
    ).toBeDisabled();
    expect(writes).toHaveLength(0);
  });
  test('overview and investigation fit the viewport without page-level horizontal overflow', async ({
    page,
  }, info) => {
    await page.goto('/platform/real-experience');
    await expect(
      page.getByRole('region', { name: 'Needs attention' })
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const dialog = document.querySelector('[role=dialog]');
        return (
          document.documentElement.scrollWidth <= window.innerWidth &&
          main.scrollWidth <= main.clientWidth &&
          (!dialog || dialog.scrollWidth <= dialog.clientWidth)
        );
      })
    ).toBe(true);
    await page.getByRole('button', { name: /Safari startup failure/ }).click();
    await expect(page.getByRole('dialog')).toContainText('User impact');
    expect(
      await page.evaluate(() => {
        const main = document.querySelector('main')!;
        const dialog = document.querySelector('[role=dialog]');
        return (
          document.documentElement.scrollWidth <= window.innerWidth &&
          main.scrollWidth <= main.clientWidth &&
          (!dialog || dialog.scrollWidth <= dialog.clientWidth)
        );
      })
    ).toBe(true);
    if (
      info.project.name === 'chromium' ||
      info.project.name === 'Mobile Safari'
    )
      await page.screenshot({
        path: info.outputPath('rux-incident-inspector.png'),
      });
    await page.getByRole('link', { name: 'Open experience evidence' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('tab', { name: 'Evidence', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('button', { name: 'Web preview', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
  });
  test('optional journeys and dark mode keep measurement meaning and readable detail', async ({
    page,
  }, info) => {
    await page.goto('/platform/real-experience');
    const pods = page.getByRole('region', { name: 'Pods journeys' });
    await expect(pods.getByText('Rebuffer time', { exact: true })).toBeHidden();
    await pods.locator('summary').filter({ hasText: 'Other journeys' }).click();
    await pods.locator('summary').filter({ hasText: 'Rebuffer time' }).click();
    await expect(
      pods.getByText(/listening outcomes; duration alone does not qualify/)
    ).toBeVisible();
    await expect(pods.getByText('1.00%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(pods.getByText('Outside target')).toBeVisible();
    await pods.locator('summary').filter({ hasText: 'Other journeys' }).click();
    if (
      info.project.name === 'chromium' ||
      info.project.name === 'Mobile Safari'
    )
      await page.screenshot({ path: info.outputPath('rux-dark-cockpit.png') });
  });
  test('low volume never displays an unqualified zero percent as a measured rate', async ({
    page,
  }) => {
    lowVolume = true;
    await page.goto('/platform/real-experience');
    const summary = page
      .getByRole('region', { name: 'Pods journeys' })
      .locator('summary')
      .filter({ hasText: 'Feed loads' });
    await expect(summary).toContainText('Needs samples');
    await expect(summary).toContainText('8/10 eligible journey outcomes');
    await expect(summary).toContainText('—');
    await expect(summary).not.toContainText('0.00%');
  });
  test('reload refreshes the evidence being inspected without writing controls', async ({
    page,
  }) => {
    await page.goto('/platform/real-experience?tab=evidence&client=ios');
    const evidenceReads = () =>
      reads.filter((path) => path.endsWith('/experience/evidence/cohorts'))
        .length;
    await expect.poll(evidenceReads).toBeGreaterThan(0);
    const previous = evidenceReads();
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect.poll(evidenceReads).toBeGreaterThan(previous);
    await expect(
      page.getByRole('button', { name: 'iOS', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(writes).toHaveLength(0);
  });
});
