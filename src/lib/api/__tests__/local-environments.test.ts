import {
  localEnvironmentAPI,
  planSchema,
  reportSchema,
  upgradeJobSchema,
} from '@/lib/api/local-environments';

it('rejects inconsistent repair proof and private job capabilities', () => {
  const action = {
    tenant_id: 'tenant',
    attempt_id: '52abf260-9d1c-4671-9c98-2e56b92b1d54',
    request_id: '613ac104-903e-41b8-a7ca-408b23577b50',
    kind: 'persisted',
    evidence: 'receipt',
  };
  const repair = {
    digest: 'a'.repeat(64),
    actions: [action],
    remaining: 1,
    reasons: { matching_attempt_receipt_missing: 1 },
  };
  const work = {
    state: 'blocked',
    count: 2,
    checks: [{ subject: 'content_stage_attempts', count: 2 }],
    attempt_repair: repair,
  };
  expect(
    reportSchema.parse({
      ...report,
      databases: [{ ...database, migration_work: work }],
    }).databases[0].migration_work?.attempt_repair?.actions
  ).toHaveLength(1);
  for (const invalid of [
    { ...repair, remaining: 2 },
    { ...repair, reasons: {} },
    { ...repair, actions: [action, action], remaining: 0, reasons: {} },
  ]) {
    expect(() =>
      reportSchema.parse({
        ...report,
        databases: [
          { ...database, migration_work: { ...work, attempt_repair: invalid } },
        ],
      })
    ).toThrow();
  }
  const job = {
    id: action.attempt_id,
    environment: 'dev',
    runtime_id: action.request_id,
    plan_id: action.attempt_id,
    digest: repair.digest,
    actor: 'iam:admin',
    state: 'applying',
    created_at: 'now',
    updated_at: 'now',
    messages: [],
  };
  expect(upgradeJobSchema.parse(job).state).toBe('applying');
  expect(() =>
    upgradeJobSchema.parse({ ...job, actor_token_hash: 'private' })
  ).toThrow();
});

const database = {
  owner: 'cms',
  target: 'ep-fixture.neon.tech/neondb',
  state: 'repair_required',
  ledger: 'incomplete',
  identity: {
    id: 'fixture',
    epoch: 0,
    fence: 'open',
    fence_epoch: 0,
    owner_state: 'running',
  },
  pending: [],
  issues: [],
  missing: [],
  schema_digest: 'schema',
  repair: { verification_digest: 'exact', actions: [{ request_id: 'one' }] },
  dirty: false,
  version: 0,
  empty: false,
};
const report = {
  id: 'report',
  environment: 'stable',
  config_revision: 'one',
  observed_at: '2026-10-02T00:00:00Z',
  state: 'needs_preparation',
  databases: [database],
  resources: [],
  build_digest: 'build',
  digest: 'exact',
};

it('preserves the owner repair evidence and rejects credentials in reports', () => {
  expect(reportSchema.parse(report).databases[0].repair?.actions).toHaveLength(
    1
  );
  expect(() =>
    reportSchema.parse({ ...report, database_url: 'postgresql://secret' })
  ).toThrow();
});

it('retains migration work evidence while accepting reports written before the work check', () => {
  expect(
    reportSchema.parse(report).databases[0].migration_work
  ).toBeUndefined();
  const migration_work = {
    state: 'blocked',
    count: 513,
    checks: [
      {
        subject: 'content_stage_attempts',
        count: 513,
        expired: 513,
        terminal_requests: 369,
      },
    ],
  };
  expect(
    reportSchema.parse({
      ...report,
      databases: [{ ...database, migration_work }],
    }).databases[0].migration_work
  ).toEqual(migration_work);
  for (const invalid of [
    { ...migration_work, state: 'ready' },
    { ...migration_work, count: 0 },
    { ...migration_work, checks: null },
    {
      ...migration_work,
      checks: [{ subject: 'attempts', count: 513, expired: 514 }],
    },
    {
      ...migration_work,
      checks: [{ subject: 'attempts', count: 513, terminal_requests: 514 }],
    },
    { ...migration_work, database_url: 'secret' },
  ]) {
    expect(() =>
      reportSchema.parse({
        ...report,
        databases: [{ ...database, migration_work: invalid }],
      })
    ).toThrow();
  }
  expect(
    reportSchema.parse({
      ...report,
      databases: [
        {
          ...database,
          migration_work: { state: 'unknown', count: 0, checks: [] },
        },
      ],
    }).databases[0].migration_work?.state
  ).toBe('unknown');
});
it('keeps blocked preparation separate from actionable effects', () => {
  const plan = {
    id: 'plan',
    environment: 'stable',
    report,
    steps: [],
    blocked: ['IAM ledger is dirty'],
    expires_at: '2026-10-02T01:00:00Z',
    digest: 'exact',
  };
  expect(planSchema.parse(plan).blocked).toEqual(['IAM ledger is dirty']);
  expect(() =>
    planSchema.parse({ ...plan, shell_command: 'force ledger' })
  ).toThrow();
});

it('reads existing overview reports with a null empty CMS issue list', async () => {
  const savedReport = {
    ...report,
    state: 'ready',
    databases: [{ ...database, state: 'ready', issues: null }],
  };
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      profiles: [],
      selection: {
        schema_version: 1,
        revision: 0,
        default_environment: 'stable',
        updated_at: '2026-10-03T00:00:00Z',
        updated_by: 'operator',
      },
      runtime: null,
      last_successful: null,
      reports: { stable: savedReport, sandbox: null },
      configuration: {
        stable: { state: 'configured', detail: 'Complete settings' },
        sandbox: {
          state: 'not_configured',
          detail: 'Missing private settings',
        },
      },
    }),
  });
  try {
    const overview = await localEnvironmentAPI.overview();
    expect(overview.reports.stable?.databases[0].issues).toEqual([]);
    expect(overview.reports.stable?.digest).toBe('exact');
    expect(overview.reports.sandbox).toBeNull();
    expect(overview.configuration?.sandbox.state).toBe('not_configured');
    expect(savedReport.databases[0].issues).toBeNull();
  } finally {
    global.fetch = originalFetch;
  }
});

it('preserves real issues and rejects malformed or missing issue evidence', () => {
  const withIssues = {
    ...report,
    databases: [{ ...database, issues: ['Owner repair required'] }],
  };
  expect(reportSchema.parse(withIssues).databases[0].issues).toEqual([
    'Owner repair required',
  ]);
  for (const issues of ['invalid', [null], [1], undefined]) {
    expect(() =>
      reportSchema.parse({
        ...report,
        databases: [{ ...database, issues }],
      })
    ).toThrow();
  }
});

it('retains the historical checksum limitation in health and preparation evidence', () => {
  const historical = {
    ...report,
    databases: [
      {
        ...database,
        warnings: ['One migration predates checksum recording.'],
        legacy_checksum_history: ['20260113000000_init.sql'],
      },
    ],
  };
  expect(
    reportSchema.parse(historical).databases[0].legacy_checksum_history
  ).toEqual(['20260113000000_init.sql']);
  expect(
    planSchema.parse({
      id: 'plan',
      environment: 'stable',
      report: historical,
      steps: [],
      blocked: [],
      expires_at: '2026-10-02T01:00:00Z',
      digest: 'exact',
    }).report.databases[0].warnings
  ).toHaveLength(1);
});

it('keeps schema qualification separate from processing completion and rejects inconsistent authority', () => {
  const work = {
    state: 'blocked',
    schema_upgrade_ready: true,
    count: 196,
    checks: [
      { subject: 'content_stage_attempts', count: 195, expired: 195 },
      { subject: 'pipeline_repair_requests', count: 1 },
    ],
  };
  const parse = (migration_work: unknown) =>
    reportSchema.parse({
      ...report,
      databases: [{ ...database, migration_work }],
    }).databases[0].migration_work;
  expect(parse(work)?.state).toBe('blocked');
  for (const invalid of [
    { ...work, state: 'ready' },
    { ...work, checks: [{ subject: 'source_run_attempts', count: 196 }] },
    {
      ...work,
      checks: [{ subject: 'content_stage_attempts', count: 196, expired: 195 }],
    },
  ])
    expect(() => parse(invalid)).toThrow();
});

it('accepts exact optional blocker evidence and rejects contradictory or unsafe evidence', () => {
  const migration = '20300101000000_example.sql';
  const work = {
    state: 'blocked',
    count: 1,
    checks: [{ subject: 'content_stage_attempts', count: 1 }],
  };
  const parse = (migration_work: unknown) =>
    reportSchema.parse({
      ...report,
      databases: [{ ...database, migration_work }],
    }).databases[0].migration_work;
  for (const blocked_by of [
    {
      reason: 'migration_not_reviewed',
      migration,
      subject: 'content_stage_attempts',
    },
    {
      reason: 'owner_reconciliation_required',
      migration,
      subject: 'content_stage_attempts',
    },
    { reason: 'live_work', subject: 'content_stage_attempts' },
  ])
    expect(parse({ ...work, blocked_by })?.blocked_by).toEqual(blocked_by);
  for (const blocked_by of [
    { reason: 'invented', subject: 'content_stage_attempts' },
    { reason: 'migration_not_reviewed' },
    { reason: 'owner_reconciliation_required', migration },
    { reason: 'live_work', subject: 'absent_owner' },
    { reason: 'live_work', subject: 'source_run_attempts' },
    {
      reason: 'migration_not_reviewed',
      migration: '20300101000000_../secret.sql',
    },
    { reason: 'migration_not_reviewed', migration, shell_command: 'force' },
  ])
    expect(() => parse({ ...work, blocked_by })).toThrow();
  const blocked_by = { reason: 'live_work', subject: 'content_stage_attempts' };
  expect(() =>
    parse({
      ...work,
      blocked_by,
      schema_upgrade_ready: true,
      checks: [{ ...work.checks[0], expired: 1 }],
    })
  ).toThrow();
  expect(() =>
    parse({ state: 'ready', count: 0, checks: [], blocked_by })
  ).toThrow();
  expect(() =>
    parse({ state: 'unknown', count: 0, checks: [], blocked_by })
  ).toThrow();
});
