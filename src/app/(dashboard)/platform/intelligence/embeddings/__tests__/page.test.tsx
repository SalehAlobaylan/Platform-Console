import { fireEvent, render, screen, within } from '@testing-library/react';
import EmbeddingLifecyclePage from '../page';
import * as hooks from '@/hooks/use-embedding-lifecycle';

jest.mock('@/hooks/use-embedding-lifecycle', () => ({
  useEmbeddingStatus: jest.fn(),
  useEmbeddingRuns: jest.fn(),
  useEmbeddingRun: jest.fn(),
  useEmbeddingCampaigns: jest.fn(),
  useEmbeddingCampaign: jest.fn(),
  useRefreshEmbeddingLifecycle: jest.fn(),
  useRunEmbeddingAudit: jest.fn(),
  useUpdateEmbeddingPolicy: jest.fn(),
  useCreateCampaign: jest.fn(),
  usePreviewCampaign: jest.fn(),
  useStartCampaign: jest.fn(),
  useCampaignAction: jest.fn(),
  useEmbeddingExceptionAction: jest.fn(),
}));
const mocked = hooks as jest.Mocked<typeof hooks>;
const target = 'a'.repeat(64);
const policy = {
  audit_enabled: false,
  audit_interval_minutes: 360,
  items_per_batch: 200,
  batches_per_run: 1,
  daily_item_cap: 5000,
  retry_ceiling: 3,
  numeric_sample_size: 64,
};
const descriptor = {
  SpaceID: target,
  Model: 'Pinned model',
  Revision: 'revision-1',
  Dimensions: 1024,
};
const statusData = {
  policy,
  latest_run: null,
  spaces: { text: descriptor, image: descriptor },
  surfaces: [],
};
const campaign = {
  id: 10,
  space: 'text',
  state: 'draft',
  target_space_id: target,
  target_model: 'Pinned model',
  target_revision: 'revision-1',
  items_per_batch: 200,
  batches_per_run: 1,
  daily_item_cap: 5000,
  retry_ceiling: 3,
  completed_count: 0,
  failed_count: 0,
  skipped_count: 0,
};
const previewData = {
  space: 'text',
  expected_space_id: target,
  resolved: true,
  dim_ok: true,
  surfaces: [{ key: 'content_text', targets: 12, kind: 'item' }],
  total_targets: 12,
  estimated_inference_calls: 12,
  blockers: [],
};
const mutate = jest.fn();
const refresh = jest.fn();
let preview: {
  data: typeof previewData | undefined;
  error: null;
  isPending: boolean;
  mutate: jest.Mock;
  reset: jest.Mock;
};

function result(data?: unknown, error: unknown = null) {
  return { data, error, isLoading: false, isFetching: false };
}
function mutation() {
  return { mutate: jest.fn(), isPending: false, error: null };
}
function setHook(name: keyof typeof hooks, value: unknown) {
  (mocked[name] as jest.Mock).mockReturnValue(value);
}

function openCampaigns() {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Campaigns/ }), {
    button: 0,
    ctrlKey: false,
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/platform/intelligence/embeddings');
  jest.clearAllMocks();
  setHook('useEmbeddingStatus', result(statusData));
  setHook('useEmbeddingRuns', result({ runs: [] }));
  setHook('useEmbeddingRun', result());
  setHook('useEmbeddingCampaigns', result({ campaigns: [] }));
  setHook(
    'useEmbeddingCampaign',
    result({ campaign, exceptions: [], actions: [] })
  );
  setHook('useRefreshEmbeddingLifecycle', refresh);
  [
    'useRunEmbeddingAudit',
    'useUpdateEmbeddingPolicy',
    'useCreateCampaign',
    'useStartCampaign',
    'useCampaignAction',
    'useEmbeddingExceptionAction',
  ].forEach((name) => setHook(name as keyof typeof hooks, mutation()));
  preview = {
    data: undefined,
    error: null,
    isPending: false,
    mutate,
    reset: jest.fn(),
  };
  setHook('usePreviewCampaign', preview);
});

it('requires a reviewed preview, exact target confirmation and reason before starting', () => {
  const start = mutation();
  setHook('useStartCampaign', start);
  setHook('useEmbeddingCampaigns', result({ campaigns: [campaign] }));
  const view = render(<EmbeddingLifecyclePage />);
  openCampaigns();
  expect(
    screen.queryByRole('button', { name: 'Start reviewed campaign #10' })
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Review start for campaign #10' })
  );
  expect(mutate).toHaveBeenCalledWith('text');
  preview.data = previewData;
  view.rerender(<EmbeddingLifecyclePage />);
  expect(
    screen.getAllByText(/Estimated inference calls: 12/).length
  ).toBeGreaterThan(0);
  const startButton = screen.getByRole('button', {
    name: 'Start reviewed campaign #10',
  });
  expect(startButton).toBeDisabled();
  fireEvent.change(
    screen.getByLabelText('Type the full target space ID to confirm'),
    { target: { value: target.slice(0, 12) } }
  );
  fireEvent.change(screen.getByLabelText('Reason to start'), {
    target: { value: 'Upgrade pinned model' },
  });
  expect(startButton).toBeDisabled();
  fireEvent.change(
    screen.getByLabelText('Type the full target space ID to confirm'),
    { target: { value: target } }
  );
  fireEvent.click(startButton);
  expect(start.mutate).toHaveBeenCalledWith({
    id: 10,
    reason: 'Upgrade pinned model',
    targetSpaceID: target,
  });
});

it('allows operators to pause a campaign during verification', () => {
  const action = mutation();
  setHook('useCampaignAction', action);
  setHook(
    'useEmbeddingCampaigns',
    result({ campaigns: [{ ...campaign, state: 'verifying' }] })
  );
  render(<EmbeddingLifecyclePage />);
  openCampaigns();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(action.mutate).toHaveBeenCalledWith({ id: 10, action: 'pause' });
});

it('keeps a changed preview target blocked and includes reviewed caps when drafting', () => {
  const create = mutation();
  setHook('useCreateCampaign', create);
  setHook('useEmbeddingCampaigns', result({ campaigns: [campaign] }));
  preview.data = { ...previewData, expected_space_id: 'b'.repeat(64) };
  render(<EmbeddingLifecyclePage />);
  openCampaigns();

  fireEvent.change(screen.getByLabelText('Items per batch'), {
    target: { value: 25 },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Create reviewed text draft' })
  );
  expect(create.mutate).toHaveBeenCalledWith(
    {
      space: 'text',
      caps: {
        items_per_batch: 25,
        batches_per_run: 1,
        daily_item_cap: 5000,
        retry_ceiling: 3,
      },
    },
    expect.any(Object)
  );
  expect(
    screen.getByText(
      'The service target changed. Abort this draft and review a new campaign.'
    )
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Start reviewed campaign #10' })
  ).toBeDisabled();
});

it('makes every exception reachable and loads terminal action history', () => {
  const exceptions = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    surface_key: 'content_text',
    target_id: `target-${i + 1}`,
    status: 'open',
    attempts: 3,
  }));
  setHook(
    'useEmbeddingCampaigns',
    result({ campaigns: [{ ...campaign, state: 'completed_with_waivers' }] })
  );
  setHook(
    'useEmbeddingCampaign',
    result({
      exceptions,
      actions: [
        {
          id: 1,
          surface_key: 'content_text',
          target_id: 'target-6',
          status: 'completed',
          tool: 'text_embedding',
          created_at: '2026-11-01T00:00:00Z',
          retry_number: 1,
          latency_ms: 20,
        },
      ],
    })
  );
  render(<EmbeddingLifecyclePage />);
  openCampaigns();
  expect(mocked.useEmbeddingCampaign).toHaveBeenCalledWith(10, false);
  expect(screen.queryByText('content_text · target-6')).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Show all 6 exceptions' })
  );
  expect(screen.getByText('content_text · target-6')).toBeVisible();
  fireEvent.click(screen.getByText('Action history (1)'));
  expect(screen.getByText('content_text · target-6 · completed')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Retry' })
  ).not.toBeInTheDocument();
});

it('distinguishes empty history from unavailable reads and refreshes every lifecycle query', () => {
  const view = render(<EmbeddingLifecyclePage />);
  expect(screen.getByText('No audit has run yet.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh all' }));
  expect(refresh).toHaveBeenCalled();
  setHook(
    'useEmbeddingStatus',
    result(undefined, { message: 'Schema unavailable' })
  );
  setHook(
    'useEmbeddingCampaigns',
    result(undefined, { message: 'Read failed' })
  );
  view.rerender(<EmbeddingLifecyclePage />);
  expect(screen.queryByText('No audit has run yet.')).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      'No campaigns. Review a draft when an audit identifies debt.'
    )
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run audit' })).toBeDisabled();
  expect(
    within(screen.getAllByRole('alert')[0]).getByText(/Schema unavailable/)
  ).toBeVisible();
});

it('explains coverage, filters attention, and reveals provenance on demand', () => {
  const surface = {
    verdict: 'drifting',
    with_vec: 100,
    current: 20,
    stale: 50,
    unstamped: 30,
    missing: 3,
    mixed_space: 0,
    space: 'text',
    semantic_availability_percent: 60,
  };
  setHook(
    'useEmbeddingStatus',
    result({
      ...statusData,
      latest_run: {
        id: 2,
        headline: 'attention',
        status: 'completed',
        started_at: '2026-11-01T12:00:00Z',
        violations_major: 1,
        violations_minor: 0,
        check_errors: 0,
        per_surface: {
          content_text: surface,
          topic_proposals: {
            ...surface,
            verdict: 'coherent',
            current: 100,
            stale: 0,
            unstamped: 0,
          },
        },
      },
      surfaces: [
        { Key: 'content_text', Label: 'Content text' },
        { Key: 'topic_proposals', Label: 'Topic proposals' },
      ],
    })
  );
  render(<EmbeddingLifecyclePage />);
  expect(screen.getByText('Text embeddings need a refresh')).toBeVisible();
  expect(screen.getByText('80')).toBeVisible();
  expect(screen.getAllByText('60%')[0]).toBeVisible();
  expect(screen.queryByText(target)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Needs attention' }));
  expect(
    screen.queryByRole('button', { name: 'Topic proposals' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Content text' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByText('Missing vectors')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Open surface owner' })
  ).toHaveAttribute('href', '/platform/enrichment');
});

it('restores a direct link to audit evidence', () => {
  window.history.replaceState(
    null,
    '',
    '/platform/intelligence/embeddings#audit-evidence'
  );
  render(<EmbeddingLifecyclePage />);
  expect(screen.getByRole('tab', { name: 'Audit history' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(screen.getByText('No audits recorded.')).toBeVisible();
});

it('prioritizes audit issues while keeping passing evidence reachable', () => {
  setHook(
    'useEmbeddingRun',
    result({
      run: { id: 2 },
      findings: [
        {
          id: 1,
          surface_key: 'content_text',
          check_key: 'stale_inventory',
          status: 'violation',
          severity: 'major',
        },
        {
          id: 2,
          surface_key: 'content_image',
          check_key: 'stale_inventory',
          status: 'pass',
          severity: '',
        },
      ],
    })
  );
  render(<EmbeddingLifecyclePage />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Audit history' }), {
    button: 0,
    ctrlKey: false,
  });
  expect(
    screen.getByText(/Content text · Stale inventory · Violation/)
  ).toBeVisible();
  expect(
    screen.queryByText(/Content image · Stale inventory · Pass/)
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show passing checks' }));
  expect(
    screen.getByText(/Content image · Stale inventory · Pass/)
  ).toBeVisible();
});
