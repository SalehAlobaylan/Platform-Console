import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EnvironmentReport } from '@/lib/api/local-environments';
import EnvironmentNextStep, { nextEnvironmentStep } from '../next-step';

function fixture(): EnvironmentReport {
  return {
    id: 'report',
    environment: 'dev',
    config_revision: 'config',
    observed_at: '2026-10-04T07:27:00Z',
    state: 'needs_preparation',
    build_digest: 'build',
    digest: 'digest',
    resources: [],
    databases: ['cms', 'iam'].map((owner) => ({
      owner,
      target: 'neon/db',
      state: owner === 'cms' ? 'upgrade_available' : 'ready',
      ledger: 'verified',
      identity: {
        id: '',
        epoch: 0,
        fence: 'absent',
        fence_epoch: 0,
        owner_state: 'absent',
      },
      pending:
        owner === 'cms'
          ? [
              {
                owner,
                file: 'new.sql',
                checksum: 'hash',
                class: 'review_required',
                effects: 'CREATE TABLE',
                requires_destructive_flag: false,
              },
            ]
          : [],
      issues: [],
      missing: [],
      schema_digest: 'schema',
      ...(owner === 'cms'
        ? { migration_work: { state: 'ready' as const, count: 0, checks: [] } }
        : {}),
      dirty: false,
      version: 19,
      empty: false,
    })),
  };
}
function blocked(): EnvironmentReport {
  const report = fixture();
  report.databases[0].migration_work = {
    state: 'blocked',
    count: 196,
    checks: [
      { subject: 'content_stage_attempts', count: 195 },
      { subject: 'pipeline_repair_requests', count: 1 },
    ],
    attempt_repair: {
      digest: 'proof',
      actions: [],
      remaining: 195,
      reasons: {
        effect_requires_owner_proof: 140,
        matching_attempt_receipt_missing: 55,
      },
    },
  };
  return report;
}
const actions = {
  onReview: jest.fn(),
  onAdvanced: jest.fn(),
  onCheck: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
});

it('gives a diagnostic handoff for the real 196-record blocker without a migration or repair action', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <EnvironmentNextStep
      report={blocked()}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  expect(
    screen.getByText('Collect an investigation report')
  ).toBeInTheDocument();
  expect(screen.getByText(/196 stored processing records/)).toBeInTheDocument();
  expect(screen.getByText(/Repeating Repair and migrate/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Review changes' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy commands' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      './scripts/env.sh diagnose --env dev'
    )
  );
  expect(screen.getByText(/Open the README.md path/)).toBeInTheDocument();
  expect(actions.onReview).not.toHaveBeenCalled();
});

it('offers a reviewed partial repair only when its exact proof is available', () => {
  const report = blocked();
  report.databases[0].migration_work!.attempt_repair!.actions.push({
    attempt_id: 'attempt',
    request_id: 'request',
    tenant_id: 'tenant',
    kind: 'persisted',
    evidence: 'receipt',
  });
  report.databases[0].migration_work!.attempt_repair!.remaining = 194;
  report.databases[0].migration_work!.attempt_repair!.reasons.matching_attempt_receipt_missing = 54;
  render(
    <EnvironmentNextStep
      report={report}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  expect(
    screen.getByText(/1 attempts have verified repair proof/)
  ).toHaveTextContent('remaining blockers may still need investigation');
  fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(actions.onReview).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/cms-migrate.sh/)).not.toBeInTheDocument();
});

it('keeps unavailable proof distinct from zero available repairs', () => {
  const report = blocked();
  delete report.databases[0].migration_work!.attempt_repair;
  render(
    <EnvironmentNextStep
      report={report}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  expect(screen.getByText(/Repair proof is unavailable/)).toBeInTheDocument();
  expect(
    screen.queryByText(/No automatic repair is available/)
  ).not.toBeInTheDocument();
});

it('copies stop, both pending owners and restart in an error-stopping script', async () => {
  const report = fixture();
  report.databases[1].pending = [
    { ...report.databases[0].pending[0], owner: 'iam' },
  ];
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <EnvironmentNextStep
      report={report}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Copy commands' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      './scripts/env.sh stop &&\n./scripts/cms-migrate.sh --env dev apply &&\n./scripts/iam-migrate.sh --env dev apply &&\n./start.sh --env dev'
    )
  );
});

it('requires starting the chosen environment before reviewing its repairs', () => {
  const report = fixture();
  report.databases[0].state = 'repair_required';
  render(
    <EnvironmentNextStep
      report={report}
      language="en"
      current={false}
      busy={false}
      {...actions}
    />
  );
  expect(screen.getByText(/first stop the current app/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Review changes' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/\.\/scripts\/env.sh stop &&\s+\.\/start.sh --env dev/)
  ).toBeInTheDocument();
});

it('shows Arabic guidance and a usable command when clipboard access fails', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
  });
  render(
    <EnvironmentNextStep
      report={blocked()}
      language="ar"
      current
      busy={false}
      {...actions}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'نسخ الأوامر' }));
  expect(await screen.findByText(/تعذر النسخ/)).toBeInTheDocument();
  expect(
    screen.getByText('./scripts/env.sh diagnose --env dev')
  ).toBeInTheDocument();
});

it('routes dirty ledgers, unknown inventory and destructive migrations away from ordinary apply', () => {
  const report = fixture();
  report.databases[1].dirty = true;
  expect(nextEnvironmentStep(report)).toBe('investigate');
  report.databases[1].dirty = false;
  report.databases[0].migration_work = {
    state: 'unknown',
    count: 0,
    checks: [],
  };
  expect(nextEnvironmentStep(report)).toBe('investigate');
  delete report.databases[0].migration_work;
  expect(nextEnvironmentStep(report)).toBe('check');
  report.databases[0].migration_work = { state: 'ready', count: 0, checks: [] };
  report.databases[0].pending[0].requires_destructive_flag = true;
  expect(nextEnvironmentStep(report)).toBe('advanced');
  report.environment = 'dev; unsafe';
  expect(nextEnvironmentStep(report)).toBe('check');
});

it('offers the migration command while keeping qualified expired history unresolved', async () => {
  const report = blocked();
  report.databases[0].migration_work!.schema_upgrade_ready = true;
  report.databases[0].migration_work!.checks[0].expired = 195;
  delete report.databases[0].migration_work!.attempt_repair;
  expect(nextEnvironmentStep(report)).toBe('migrate');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <EnvironmentNextStep
      report={report}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  expect(
    screen.getByText(/196 unresolved processing records will be preserved/)
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Collect an investigation report/)
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy commands' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      './scripts/env.sh stop &&\n./scripts/cms-migrate.sh --env dev apply &&\n./start.sh --env dev'
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(actions.onReview).toHaveBeenCalledTimes(1);
  report.databases[0].pending[0].requires_destructive_flag = true;
  expect(nextEnvironmentStep(report)).toBe('advanced');
});

it.each(['en', 'ar'] as const)(
  'waits for the named live owner without offering repair or apply in %s',
  (language) => {
    const report = blocked();
    report.databases[0].migration_work!.blocked_by = {
      reason: 'live_work',
      subject: 'content_stage_attempts',
    };
    report.databases[0].migration_work!.attempt_repair!.actions.push({
      attempt_id: 'attempt',
      request_id: 'request',
      tenant_id: 'tenant',
      kind: 'persisted',
      evidence: 'receipt',
    });
    expect(nextEnvironmentStep(report)).toBe('wait');
    render(
      <EnvironmentNextStep
        report={report}
        language={language}
        current
        busy={false}
        {...actions}
      />
    );
    expect(screen.getByText('content_stage_attempts')).toBeInTheDocument();
    expect(
      screen.queryByText(/cms-migrate.sh|diagnose --env/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Review changes|مراجعة التغييرات/ })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: language === 'en' ? 'Check again' : 'إعادة الفحص',
      })
    );
    expect(actions.onCheck).toHaveBeenCalledTimes(1);
  }
);

it.each(['migration_not_reviewed', 'owner_reconciliation_required'] as const)(
  'names the exact %s migration before the diagnostic command',
  (reason) => {
    const report = blocked();
    const migration = '20300101000000_example.sql';
    report.databases[0].migration_work!.blocked_by = {
      reason,
      migration,
      subject: 'content_stage_attempts',
    };
    render(
      <EnvironmentNextStep
        report={report}
        language="en"
        current
        busy={false}
        {...actions}
      />
    );
    expect(screen.getByText(migration)).toBeInTheDocument();
    expect(
      screen.getByText('./scripts/env.sh diagnose --env dev')
    ).toBeInTheDocument();
    expect(screen.queryByText(/cms-migrate.sh/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Repeating Repair and migrate/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review changes' })
    ).not.toBeInTheDocument();
  }
);

it('asks for a fresh check when an older saved report cannot identify its blocker', () => {
  render(
    <EnvironmentNextStep
      report={blocked()}
      language="en"
      current
      busy={false}
      {...actions}
    />
  );
  expect(
    screen.getByText(/This saved check does not identify the specific blocker/)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(actions.onCheck).toHaveBeenCalledTimes(1);
});
