import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import Page from '../page';
import { localEnvironmentAPI } from '@/lib/api/local-environments';

jest.mock('@/lib/api/local-environments', () => ({
  localEnvironmentAPI: {
    overview: jest.fn(),
    inspect: jest.fn(),
    select: jest.fn(),
    plan: jest.fn(),
    upgradePlan: jest.fn(),
    upgrade: jest.fn(),
    upgradeJob: jest.fn(),
    review: jest.fn(),
    history: jest.fn(),
  },
}));
jest.mock(
  '@/components/platform/database-environments/relocation-panel',
  () => ({ __esModule: true, default: () => <div>Independent relocation</div> })
);
const api = localEnvironmentAPI as jest.Mocked<typeof localEnvironmentAPI>;
const report = {
  id: 'one',
  environment: 'sandbox',
  config_revision: 'one',
  observed_at: '2026-10-02T00:00:00Z',
  state: 'needs_preparation',
  databases: [],
  resources: [],
  build_digest: 'build',
  digest: 'digest',
};
const overview = {
  profiles: [
    {
      id: 'stable',
      purpose: 'retained',
      preservation: 'preserve',
      cms_database_id: '',
      iam_database_id: '',
    },
    {
      id: 'sandbox',
      purpose: 'experiments',
      preservation: 'preserve',
      cms_database_id: '',
      iam_database_id: '',
    },
  ],
  selection: {
    schema_version: 1,
    revision: 0,
    default_environment: 'stable',
    updated_at: '2026-10-02T00:00:00Z',
    updated_by: '',
  },
  runtime: { id: 'launch', environment: 'stable', state: 'running' },
  last_successful: { environment: 'stable' },
  reports: { sandbox: report },
  configuration: {
    stable: { state: 'configured', detail: 'Settings complete' },
    sandbox: { state: 'configured', detail: 'Settings complete' },
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  api.overview.mockResolvedValue(overview as never);
});
afterEach(() => jest.useRealTimers());

it('shows editable file guidance without changing the running stack', async () => {
  api.overview.mockResolvedValue({
    ...overview,
    configuration: {
      ...overview.configuration,
      sandbox: {
        state: 'not_configured',
        detail: 'Private settings are missing',
      },
    },
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  expect(
    screen.getByText('Not configured', { exact: false })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Use on next startup' })
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  ).toBeDisabled();
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Environment files' })[1]
  );
  expect(screen.getByText('./scripts/env.sh add sandbox')).toBeInTheDocument();
  expect(
    screen.getByText(/Existing settings stay in your private file/)
  ).toBeInTheDocument();
  expect(api.select).not.toHaveBeenCalled();
  expect(api.inspect).not.toHaveBeenCalled();
});

it('clears a previous loading error after a successful status poll', async () => {
  jest.useFakeTimers();
  const previousError = 'Expected array, received null';
  api.overview.mockRejectedValueOnce(new Error(previousError));
  render(<Page />);
  expect(await screen.findByRole('alert')).toHaveTextContent(previousError);

  await act(async () => {
    jest.advanceTimersByTime(15_000);
  });

  await screen.findByText('experiments');
  expect(screen.getByText('stable · running')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.inspect).not.toHaveBeenCalled();
});

it('shows terminal file choices without selecting or preparing an environment', async () => {
  render(<Page />);
  await screen.findByText('experiments');
  expect(screen.getByText('./start.sh --env sandbox')).toBeInTheDocument();
  expect(screen.getByText('./start.sh --env stable')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Use on next startup' })
  ).not.toBeInTheDocument();
  expect(api.select).not.toHaveBeenCalled();
  expect(api.inspect).not.toHaveBeenCalled();
  expect(api.plan).not.toHaveBeenCalled();
  expect(screen.getByText('stable · running')).toBeInTheDocument();
});

it('shows the explicit owner migration command without starting preparation', async () => {
  api.inspect.mockResolvedValue({
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        ledger: 'incomplete',
        migration_work: { state: 'ready', count: 0, checks: [] },
        target: 'database',
        pending: [{ file: 'new.sql' }],
        issues: [],
        missing: [],
        identity: { id: '', epoch: 0 },
        dirty: false,
        version: 0,
        empty: false,
      },
    ],
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(
    await screen.findByText(/\.\/scripts\/cms-migrate.sh --env sandbox apply/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Pending migrations allow local startup/)
  ).toHaveTextContent(
    'it stops the app, applies pending owner migrations, then starts this environment.'
  );
  expect(api.plan).not.toHaveBeenCalled();
  expect(api.review).not.toHaveBeenCalled();
});
it('a status poll does not discard an open preparation review', async () => {
  jest.useFakeTimers();
  render(<Page />);
  await screen.findByText('experiments');
  api.inspect.mockResolvedValue(report as never);
  const healthButtons = screen.getAllByRole('button', {
    name: 'Database health',
  });
  fireEvent.click(healthButtons[1]);
  api.plan.mockResolvedValue({
    id: 'plan',
    environment: 'sandbox',
    report,
    steps: [
      {
        owner: 'cms',
        kind: 'source_run_repair',
        summary: 'Reconcile exact records',
      },
    ],
    blocked: [],
    expires_at: '2026-10-02T01:00:00Z',
    digest: 'digest',
  } as never);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Advanced recovery' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Advanced recovery' }));
  await screen.findByText('Reconcile exact records');
  api.overview.mockResolvedValue({
    ...overview,
    reports: { sandbox: { ...report } },
  } as never);
  await act(async () => {
    jest.advanceTimersByTime(15_000);
  });
  expect(
    screen.getByRole('button', { name: 'Save reviewed preparation' })
  ).toBeEnabled();
  expect(api.inspect).toHaveBeenCalledTimes(1);
});

it('shows the attempt blocker and never offers a command or approval that cannot execute', async () => {
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
  } as never);
  const blockedReport = {
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        target: 'database',
        pending: [{ file: 'new.sql' }],
        issues: [],
        missing: [],
        migration_work: {
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
          attempt_repair: {
            digest: 'proof',
            actions: Array.from({ length: 318 }, () => ({ kind: 'persisted' })),
            remaining: 195,
            reasons: {
              effect_requires_owner_proof: 140,
              matching_attempt_receipt_missing: 55,
            },
          },
        },
      },
    ],
  };
  api.inspect.mockResolvedValue(blockedReport as never);
  api.plan.mockResolvedValue({
    id: 'blocked',
    environment: 'sandbox',
    report: blockedReport,
    steps: [],
    blocked: ['CMS attempts require owner reconciliation.'],
    expires_at: '2026-10-02T01:00:00Z',
    digest: 'exact',
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(await screen.findByText('Migration blocked')).toBeInTheDocument();
  expect(screen.getByText(/513 stored work records/)).toBeInTheDocument();
  expect(screen.getByText(/318 attempts have proof/)).toBeInTheDocument();
  expect(
    screen.getByText(/195 content attempts still need evidence/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/140 · Completion or the current output/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/55 · The completion receipt for this exact attempt/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Repeating checks only refreshes the evidence/)
  ).toBeInTheDocument();
  expect(screen.getByText(/Expired leases: 513/)).toHaveTextContent(
    'Attempts linked to closed requests: 369'
  );
  expect(screen.getByRole('link', { name: 'Open Pipeline' })).toHaveAttribute(
    'href',
    '/platform/pipeline'
  );
  expect(
    screen.queryByText('./scripts/cms-migrate.sh --env sandbox apply')
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Advanced recovery' }));
  await screen.findByText('CMS attempts require owner reconciliation.');
  expect(
    screen.getByRole('button', { name: 'Save reviewed preparation' })
  ).toBeDisabled();
  expect(
    screen.queryByText('./scripts/env.sh prepare --env sandbox')
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/This review cannot be saved or executed/)
  ).toBeInTheDocument();
  expect(api.review).not.toHaveBeenCalled();
});

it('does not route an inactive environment blocker to the running environment workflow', async () => {
  api.inspect.mockResolvedValue({
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        target: 'database',
        pending: [{ file: 'new.sql' }],
        issues: [],
        missing: [],
        migration_work: {
          state: 'blocked',
          count: 1,
          checks: [{ subject: 'content_stage_attempts', count: 1 }],
        },
      },
    ],
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await screen.findByText('Migration blocked');
  expect(
    screen.queryByRole('link', { name: 'Open Pipeline' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(
      'Inspect the owning workflow while this environment is running.'
    )
  ).toBeInTheDocument();
});

it('requires reviewing changes before queueing a run and keeps job progress visible', async () => {
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
  } as never);
  const repairReport = {
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        target: 'database',
        pending: [{ file: '20300101000000_example.sql' }],
        issues: [],
        missing: [],
        migration_work: {
          state: 'blocked',
          count: 2,
          checks: [{ subject: 'content_stage_attempts', count: 2, expired: 2 }],
          blocked_by: {
            reason: 'owner_reconciliation_required',
            subject: 'content_stage_attempts',
          },
          attempt_repair: {
            digest: 'a'.repeat(64),
            actions: [{ kind: 'persisted' }],
            remaining: 1,
            reasons: { effect_requires_owner_proof: 1 },
          },
        },
      },
    ],
  };
  api.inspect.mockResolvedValue(repairReport as never);
  api.upgradePlan.mockResolvedValue({
    id: 'reviewed',
    mode: 'upgrade',
    environment: 'sandbox',
    report: repairReport,
    steps: [
      {
        owner: 'cms',
        kind: 'attempt_repair',
        summary:
          'Reconcile exact receipt-bound attempts. Migrations remain blocked by unknown effects.',
      },
    ],
    blocked: [],
    expires_at: '2026-10-04T12:00:00Z',
    digest: 'reviewed-digest',
  } as never);
  const job = {
    id: 'job',
    environment: 'sandbox',
    runtime_id: 'launch',
    state: 'queued',
    created_at: '2026-10-04T10:00:00Z',
    updated_at: '2026-10-04T10:00:00Z',
    messages: [{ at: '2026-10-04T10:00:00Z', text: 'Changes queued' }],
  };
  api.upgrade.mockResolvedValue(job as never);
  api.upgradeJob.mockResolvedValue({
    ...job,
    state: 'needs_attention',
    messages: [
      {
        at: job.updated_at,
        text: 'Proven attempts reconciled. Unknown effects still need owner proof.',
      },
    ],
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Repair and migrate' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Repair and migrate' }));
  await screen.findByText(/Reconcile exact receipt-bound attempts/, {
    selector: 'li',
  });
  expect(api.upgrade).not.toHaveBeenCalled();
  expect(
    screen.queryByText('./scripts/env.sh prepare --env sandbox')
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm and run reviewed changes' })
  );
  await screen.findByText(
    'Proven attempts reconciled. Unknown effects still need owner proof.',
    { exact: false, selector: 'li' }
  );
  expect(api.upgrade).toHaveBeenCalledTimes(1);
  expect(api.upgrade).toHaveBeenCalledWith('reviewed', 'reviewed-digest');
  expect(api.review).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Confirm and run reviewed changes' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Proven attempts reconciled. Unknown effects still need owner proof.'
  );
});

it('keeps inactive environment diagnosis read-only', async () => {
  api.inspect.mockResolvedValue(report as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Check now' })).toBeEnabled()
  );
  expect(
    screen.getByRole('button', { name: 'Repair and migrate' })
  ).toBeDisabled();
  expect(
    screen.getByText(/To execute changes, start this environment first/)
  ).toBeInTheDocument();
  expect(api.upgradePlan).not.toHaveBeenCalled();
});

it('replaces the pre-run proof and work count with the verified result after a partial repair', async () => {
  const before = {
    ...report,
    id: 'before-repair',
    observed_at: '2026-10-04T07:00:35Z',
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        target: 'database',
        pending: [{ file: 'new.sql' }],
        issues: [],
        missing: [],
        migration_work: {
          state: 'blocked',
          count: 514,
          checks: [
            { subject: 'content_stage_attempts', count: 513 },
            { subject: 'pipeline_repair_requests', count: 1 },
          ],
          attempt_repair: {
            digest: 'proof',
            actions: Array.from({ length: 318 }, () => ({ kind: 'persisted' })),
            remaining: 195,
            reasons: {},
          },
        },
      },
    ],
  };
  const after = {
    ...before,
    id: 'after-repair',
    observed_at: '2026-10-04T07:08:39Z',
    databases: [
      {
        ...before.databases[0],
        migration_work: {
          state: 'blocked',
          count: 196,
          checks: [
            { subject: 'content_stage_attempts', count: 195 },
            { subject: 'pipeline_repair_requests', count: 1 },
          ],
        },
      },
    ],
  };
  const runningOverview = {
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
    reports: { sandbox: before },
  };
  api.overview.mockResolvedValue(runningOverview as never);
  api.inspect.mockResolvedValue(before as never);
  api.upgradePlan.mockResolvedValue({
    id: 'reviewed',
    mode: 'upgrade',
    environment: 'sandbox',
    report: before,
    steps: [
      {
        owner: 'cms',
        kind: 'attempt_repair',
        summary: 'Settle 318 proven attempts',
      },
    ],
    blocked: [],
    expires_at: '2026-10-04T07:20:35Z',
    digest: 'reviewed-digest',
  } as never);
  const job = {
    id: 'job',
    environment: 'sandbox',
    runtime_id: 'launch',
    state: 'queued',
    created_at: '2026-10-04T07:02:59Z',
    updated_at: '2026-10-04T07:02:59Z',
    messages: [{ at: '2026-10-04T07:02:59Z', text: 'Changes queued' }],
  };
  api.upgrade.mockResolvedValue(job as never);
  api.upgradeJob.mockResolvedValue({
    ...job,
    state: 'needs_attention',
    updated_at: '2026-10-04T07:09:28Z',
    messages: [
      {
        at: '2026-10-04T07:09:28Z',
        text: '318 attempts repaired; 196 records remain.',
      },
    ],
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await screen.findByText(/514 stored work records/);
  fireEvent.click(screen.getByRole('button', { name: 'Repair and migrate' }));
  await screen.findByText('Settle 318 proven attempts', {
    exact: false,
    selector: 'li',
  });
  expect(screen.getByText(/318 attempts have proof/)).toBeInTheDocument();

  api.overview.mockResolvedValue({
    ...runningOverview,
    reports: { sandbox: after },
  } as never);
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm and run reviewed changes' })
  );
  expect(
    await screen.findByText(/196 stored work records/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Content processing attempts · 195/)
  ).toBeInTheDocument();
  expect(screen.queryByText(/514 stored work records/)).not.toBeInTheDocument();
  expect(screen.queryByText(/318 attempts have proof/)).not.toBeInTheDocument();
  expect(api.upgrade).toHaveBeenCalledTimes(1);
});

it('does not replace an open review with a newer background report', async () => {
  jest.useFakeTimers();
  const reviewed = {
    ...report,
    observed_at: '2026-10-04T07:00:35Z',
    resources: [
      {
        resource: 'review evidence',
        state: 'ready',
        target: '',
        detail: 'Reviewed snapshot',
      },
    ],
  };
  api.inspect.mockResolvedValue(reviewed as never);
  api.plan.mockResolvedValue({
    id: 'reviewed',
    environment: 'sandbox',
    report: reviewed,
    steps: [
      { owner: 'cms', kind: 'migration', summary: 'Exact reviewed migration' },
    ],
    blocked: [],
    expires_at: '2026-10-04T07:20:35Z',
    digest: 'review-digest',
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await screen.findByText('Reviewed snapshot');
  fireEvent.click(screen.getByRole('button', { name: 'Advanced recovery' }));
  await screen.findByText('Exact reviewed migration', {
    exact: false,
    selector: 'li',
  });
  api.overview.mockResolvedValue({
    ...overview,
    reports: {
      sandbox: {
        ...reviewed,
        id: 'newer',
        observed_at: '2026-10-04T07:08:39Z',
        resources: [
          {
            resource: 'new evidence',
            state: 'ready',
            target: '',
            detail: 'New background snapshot',
          },
        ],
      },
    },
  } as never);
  await act(async () => {
    jest.advanceTimersByTime(15_000);
  });
  expect(screen.getByText('Reviewed snapshot')).toBeInTheDocument();
  expect(screen.queryByText('New background snapshot')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close review' }));
  expect(
    await screen.findByText('New background snapshot')
  ).toBeInTheDocument();
});

it('keeps a stopped job from an earlier launch in collapsed history', async () => {
  const reason =
    'No repair or migration changes were started. An external client prevented execution.';
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
    upgrades: {
      sandbox: {
        id: 'previous-job',
        environment: 'sandbox',
        runtime_id: 'previous-launch',
        state: 'needs_attention',
        created_at: '2026-10-04T06:00:00Z',
        updated_at: '2026-10-04T06:01:00Z',
        messages: [{ at: '2026-10-04T06:01:00Z', text: reason }],
      },
    },
  } as never);
  api.inspect.mockResolvedValue(report as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(await screen.findByText(/Previous app launch/)).toBeInTheDocument();
  const history = screen.getByText(/Previous app launch/).closest('details');
  expect(history).not.toHaveAttribute('open');
  expect(history).toHaveTextContent(reason);
  expect(
    screen.getByText(/Use the current Next step below/)
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.upgrade).not.toHaveBeenCalled();
  expect(api.upgradeJob).not.toHaveBeenCalled();
});

const readyReport = {
  ...report,
  state: 'ready',
  observed_at: '2026-10-04T10:58:50Z',
  databases: ['cms', 'iam'].map((owner) => ({
    owner,
    state: 'ready',
    ledger: 'verified',
    target: 'database',
    pending: [],
    issues: [],
    missing: [],
    identity: { id: '', epoch: 0 },
    dirty: false,
    version: 0,
    empty: false,
  })),
};
const earlierJob = {
  id: 'previous-job',
  environment: 'sandbox',
  runtime_id: 'previous-launch',
  state: 'needs_attention',
  created_at: '2026-10-04T07:02:59Z',
  updated_at: '2026-10-04T07:09:28Z',
  messages: [
    {
      at: '2026-10-04T07:09:28Z',
      text: '196 work records still require owner proof; migrations remain pending.',
    },
  ],
};

it.each(['en', 'ar'])(
  'prioritizes a fresh successful check over an earlier stopped attempt in %s',
  async (language) => {
    api.overview.mockResolvedValue({
      ...overview,
      runtime: { ...overview.runtime, environment: 'sandbox' },
      reports: { sandbox: readyReport },
      upgrades: { sandbox: earlierJob },
    } as never);
    api.inspect.mockResolvedValue(readyReport as never);
    render(<Page />);
    await screen.findByText('experiments');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Database health' })[1]
    );
    await screen.findByText('Database checks passed');
    if (language === 'ar')
      fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(
      screen.getByText(
        language === 'ar'
          ? 'اجتازت قاعدة البيانات الفحص'
          : 'Database checks passed'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        language === 'ar'
          ? /اجتازت قاعدة البيانات الفحص الأحدث/
          : /The latest database check passed/
      )
    ).toBeInTheDocument();
    const history = screen
      .getByText(
        language === 'ar' ? /تشغيل سابق للتطبيق/ : /Previous app launch/
      )
      .closest('details');
    expect(history).not.toHaveAttribute('open');
    expect(history).toHaveTextContent(earlierJob.messages[0].text);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: language === 'ar' ? 'أصلح ونفّذ الترحيلات' : 'Repair and migrate',
      })
    ).toBeDisabled();
    expect(api.upgrade).not.toHaveBeenCalled();
    expect(api.upgradeJob).not.toHaveBeenCalled();
  }
);

it.each([
  { observed_at: '2026-10-04T07:00:00Z' },
  { observed_at: 'unreadable' },
  { environment: 'stable' },
])(
  'does not infer a newer successful check from mismatched evidence: %j',
  async (evidence) => {
    const health = { ...readyReport, ...evidence };
    api.overview.mockResolvedValue({
      ...overview,
      runtime: { ...overview.runtime, environment: 'sandbox' },
      reports: { sandbox: health },
      upgrades: { sandbox: earlierJob },
    } as never);
    api.inspect.mockResolvedValue(health as never);
    render(<Page />);
    await screen.findByText('experiments');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Database health' })[1]
    );
    expect(
      await screen.findByText(/Use the current Next step below/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/The latest database check passed/)
    ).not.toBeInTheDocument();
  }
);

it('keeps a current launch failure visible even when the database check passes', async () => {
  const reason =
    'Database verification succeeded, but service restoration failed.';
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
    reports: { sandbox: readyReport },
    upgrades: {
      sandbox: {
        ...earlierJob,
        runtime_id: 'launch',
        messages: [{ at: earlierJob.updated_at, text: reason }],
      },
    },
  } as never);
  api.inspect.mockResolvedValue(readyReport as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(await screen.findByText('Database checks passed')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(reason);
  expect(screen.queryByText(/Previous app launch/)).not.toBeInTheDocument();
});

it('does not collapse an active job because its launch differs', async () => {
  const activeJob = { ...earlierJob, state: 'applying' };
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
    upgrades: { sandbox: activeJob },
  } as never);
  api.upgradeJob.mockResolvedValue(activeJob as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(
    await screen.findByText(/Repair and migration progress/)
  ).toBeInTheDocument();
  expect(screen.queryByText(/Previous app launch/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check now' })).toBeDisabled();
});

it('offers reviewed schema migration while retaining expired processing history', async () => {
  const health = {
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        ledger: 'incomplete',
        target: 'database',
        pending: [{ file: 'qualified.sql' }],
        issues: [],
        missing: [],
        identity: { id: '', epoch: 0 },
        dirty: false,
        version: 0,
        empty: false,
        migration_work: {
          state: 'blocked',
          schema_upgrade_ready: true,
          count: 196,
          checks: [
            { subject: 'content_stage_attempts', count: 195, expired: 195 },
            { subject: 'pipeline_repair_requests', count: 1 },
          ],
        },
      },
    ],
  };
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
    reports: { sandbox: health },
  } as never);
  api.inspect.mockResolvedValue(health as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  expect(
    await screen.findByText('Processing history retained · 196')
  ).toBeInTheDocument();
  expect(screen.queryByText('Migration blocked')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Repair and migrate' })
  ).toBeEnabled();
  expect(
    screen.getByText(/cms-migrate.sh --env sandbox apply/)
  ).toBeInTheDocument();
  expect(api.upgrade).not.toHaveBeenCalled();
});

it('disables Repair and migrate when exact evidence names live owner work', async () => {
  api.overview.mockResolvedValue({
    ...overview,
    runtime: { ...overview.runtime, environment: 'sandbox' },
  } as never);
  api.inspect.mockResolvedValue({
    ...report,
    databases: [
      {
        owner: 'cms',
        state: 'upgrade_available',
        target: 'database',
        pending: [{ file: '20300101000000_example.sql' }],
        issues: [],
        missing: [],
        migration_work: {
          state: 'blocked',
          count: 1,
          checks: [{ subject: 'pipeline_stage_leases', count: 1 }],
          blocked_by: { reason: 'live_work', subject: 'pipeline_stage_leases' },
        },
      },
    ],
  } as never);
  render(<Page />);
  await screen.findByText('experiments');
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Database health' })[1]
  );
  await screen.findByText('Wait for the owning workflow');
  expect(
    screen.getByRole('button', { name: 'Repair and migrate' })
  ).toBeDisabled();
  expect(
    screen.queryByText(/cms-migrate.sh --env sandbox/)
  ).not.toBeInTheDocument();
  expect(api.upgradePlan).not.toHaveBeenCalled();
});
