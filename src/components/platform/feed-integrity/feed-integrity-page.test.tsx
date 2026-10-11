import { render, screen, fireEvent } from '@testing-library/react';
import FeedIntegrityPage from '@/app/(dashboard)/platform/feed-integrity/page';
import * as hooks from '@/hooks/use-feed-integrity';
let mockParams = '';
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockParams),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/hooks/use-feed-integrity');
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('./feed-integrity-autopilot-panel', () => ({
  FeedIntegrityAutopilotPanel: () => null,
  IntegrityEvidence: ({ value }: { value: unknown }) => (
    <pre>{JSON.stringify(value)}</pre>
  ),
}));
const mutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false };
const episode = {
  id: 'episode-a',
  check_key: 'probe_url_dead',
  feed: 'pods',
  variant: 'default',
  scope: 'content:a:primary',
  summary: 'Dead primary playback',
  severity: 'major',
  status: 'open',
  first_detected_at: '2026-10-10',
  last_seen_at: '2026-10-10',
  evidence: { reason: 'http_404' },
  attribution: { owner: 'storage', deep_link: '/platform/storage' },
};
const observation = {
  version: 1,
  check_key: 'probe_url_dead',
  feed: 'pods',
  variant: 'default',
  axis: 'consumer',
  severity: 'major',
  outcome: 'violation',
  sample_count: 2,
  candidate_count: 2,
  affected_count: 1,
  observed_at: '2026-10-11T08:00:00Z',
  coverage: 'sampled',
  targets: [{ scope: episode.scope, outcome: 'violation' }],
};
const data = {
  policy: {
    edge_pages_per_feed: 3,
    light_interval_minutes: 15,
    deep_interval_hours: 24,
  },
  headline: 'attention',
  posture: 'manual_only',
  open_episodes: [episode],
  active_suppressions: [],
  current_observations: [observation],
  current_feed_results: {
    pods: {
      consumer_score: null,
      readiness_score: 100,
      consumer_verdict: 'inconclusive',
      readiness_verdict: 'healthy',
    },
  },
  checks: [],
};
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = '';
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
    data,
    isError: false,
    refetch: jest.fn(),
  });
  (hooks.useFeedIntegrityRuns as jest.Mock).mockReturnValue({
    data: { items: [] },
  });
  (hooks.useFeedIntegrityRun as jest.Mock).mockReturnValue({});
  for (const key of [
    'useCloseFeedIntegrityEpisode',
    'useCreateFeedIntegritySuppression',
    'usePauseFeedIntegritySchedule',
    'useRevokeFeedIntegritySuppression',
    'useRunFeedIntegrity',
    'useUpdateFeedIntegrityPolicy',
  ] as const)
    (hooks[key] as jest.Mock).mockReturnValue(mutation);
});
it('keeps playback failure visible alongside incomplete response checks without a healthy percentage', () => {
  (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
    data: {
      ...data,
      current_observations: [
        observation,
        {
          ...observation,
          check_key: 'edge_pods_http',
          outcome: 'check_error',
          reason: 'response_timeout',
          affected_count: 0,
          targets: [],
        },
        {
          ...observation,
          check_key: 'inv_pods_bounds',
          outcome: 'pass',
          affected_count: 0,
        },
      ],
    },
  });
  render(<FeedIntegrityPage />);
  expect(
    screen.getAllByText('Primary playback files are unavailable').length
  ).toBeGreaterThan(0);
  expect(screen.getAllByText('Check incomplete').length).toBeGreaterThan(0);
  expect(screen.getByText('Inventory rules passed')).toBeInTheDocument();
  expect(screen.queryByText(/100%/)).toBeNull();
  expect(screen.getByText(/not users affected/)).toBeInTheDocument();
});
it('retains cached evidence on read failure and disables checks', () => {
  (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
    data,
    isError: true,
    error: new Error('connection failed'),
  });
  render(<FeedIntegrityPage />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Showing last loaded evidence'
  );
  expect(screen.getByRole('button', { name: 'Check feeds' })).toBeDisabled();
  expect(screen.queryByText('Inventory rules passed')).toBeNull();
});
it.each([
  ['check_error', false, true],
  ['skipped:budget', false, true],
  ['pass', true, true],
  ['pass', false, false],
  ['violation', false, false],
])(
  'filters exact-target outcome %s (stale=%s) as awaiting verification=%s',
  (outcome, stale, awaiting) => {
    mockParams = 'tab=issues&state=unverified';
    (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
      data: {
        ...data,
        current_observations: [
          {
            ...observation,
            outcome,
            stale,
            targets: [{ scope: episode.scope, outcome }],
          },
        ],
      },
    });
    render(<FeedIntegrityPage />);
    if (awaiting) {
      expect(
        screen.queryByText('No issues match these filters')
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /a:primary/ })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Last seen.*Awaiting fresh verification/)
      ).toBeInTheDocument();
    } else {
      expect(
        screen.getByText('No issues match these filters')
      ).toBeInTheDocument();
    }
  }
);
it('records review navigation in the URL', () => {
  render(<FeedIntegrityPage />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Review issues' })[0]);
  expect(mockReplace).toHaveBeenCalledWith(
    '/platform/feed-integrity?tab=issues&feed=pods',
    { scroll: false }
  );
});
it('requires a note and chosen closure reason and preserves the exact suppression scope', () => {
  mockParams = 'tab=issues&selected=episode-a';
  render(<FeedIntegrityPage />);
  fireEvent.click(screen.getByText('Administrative decisions'));
  expect(screen.getByRole('button', { name: 'Record closure' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Suppress exact scope' })
  ).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Open Storage' })).toHaveAttribute(
    'href',
    '/platform/storage'
  );
  fireEvent.change(screen.getByLabelText('Episode decision note'), {
    target: { value: 'Owner will repair this asset' },
  });
  expect(screen.getByRole('button', { name: 'Record closure' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Suppress exact scope' }));
  expect(mutation.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: episode.scope,
      reason: 'Owner will repair this asset',
      ttl_minutes: 60,
    }),
    expect.anything()
  );
  fireEvent.change(screen.getByLabelText('Close reason'), {
    target: { value: 'accepted_debt' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record closure' }));
  expect(mutation.mutate).toHaveBeenCalledWith(
    {
      id: episode.id,
      reason: 'accepted_debt',
      notes: 'Owner will repair this asset',
    },
    expect.anything()
  );
});
it('keeps numeric edits as a draft, validates them, then saves a bounded patch', () => {
  mockParams = 'tab=settings';
  render(<FeedIntegrityPage />);
  fireEvent.click(screen.getByText('Advanced check settings'));
  const input = screen.getByLabelText('Pages per feed');
  fireEvent.change(input, { target: { value: '999' } });
  fireEvent.blur(input);
  expect(mutation.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save check settings' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'whole number between 1–5'
  );
  expect(mutation.mutate).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save check settings' }));
  expect(mutation.mutate).toHaveBeenCalledWith(
    { edge_pages_per_feed: 4 },
    expect.anything()
  );
});
it('uses the selected run for findings and does not fetch global findings', () => {
  mockParams = 'tab=activity&run=11';
  (hooks.useFeedIntegrityRun as jest.Mock).mockReturnValue({
    data: {
      run: { id: '11', status: 'completed', started_at: '2026-10-10' },
      findings: [
        {
          id: 'f',
          check_key: 'probe_url_dead',
          feed: 'pods',
          variant: 'default',
          status: 'violation',
          target_ref: 'content:a',
        },
      ],
    },
  });
  render(<FeedIntegrityPage />);
  expect(hooks.useFeedIntegrityRun).toHaveBeenCalledWith('11');
  expect(hooks.useFeedIntegrityFindings).not.toHaveBeenCalled();
  expect(screen.getByText(/findings in this check/)).toHaveTextContent('1');
});
it('supports a URL-selected Arabic inspector with the same decision controls', () => {
  mockParams = 'tab=issues&selected=episode-a&locale=ar';
  render(<FeedIntegrityPage />);
  expect(
    screen.getByRole('heading', { name: 'سلامة الخلاصات' }).closest('[dir]')
  ).toHaveAttribute('dir', 'rtl');
  expect(screen.getByRole('link', { name: 'فتح التخزين' })).toBeInTheDocument();
  fireEvent.click(screen.getByText('القرارات الإدارية'));
  expect(
    screen.getByRole('button', { name: 'كتم النطاق الدقيق' })
  ).toBeDisabled();
});
it('does not consider an old issue rechecked because another target passed', () => {
  mockParams = 'tab=issues&selected=episode-a';
  (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
    data: {
      ...data,
      current_observations: [
        {
          ...observation,
          outcome: 'pass',
          affected_count: 0,
          targets: [{ scope: 'content:b:primary', outcome: 'pass' }],
        },
      ],
    },
  });
  render(<FeedIntegrityPage />);
  expect(
    screen.getAllByText('Awaiting fresh verification').length
  ).toBeGreaterThan(1);
});

it('renders a single mobile inspector with its own accessible title', () => {
  mockParams = 'tab=issues&selected=episode-a';
  (window.matchMedia as jest.Mock).mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  render(<FeedIntegrityPage />);
  expect(
    screen.getByRole('dialog', { name: 'Issue inspector' })
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Copy exact target' })
  ).toHaveLength(1);
});

it('shows an explicit message when a bookmarked episode leaves the open list', () => {
  mockParams = 'tab=issues&selected=old-episode';
  render(<FeedIntegrityPage />);
  expect(
    screen.getByText(/This issue is no longer in the open issue list/)
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record closure' })).toBeNull();
});

it('uses neutral names for passed checks instead of declaring a problem', () => {
  (hooks.useFeedIntegrityStatus as jest.Mock).mockReturnValue({
    data: {
      ...data,
      open_episodes: [],
      current_observations: [
        {
          ...observation,
          check_key: 'inv_pods_bounds',
          outcome: 'pass',
          affected_count: 0,
        },
      ],
    },
  });
  render(<FeedIntegrityPage />);
  fireEvent.click(screen.getByText('Inspect all check results'));
  expect(screen.getByText(/Media duration limits/)).toBeInTheDocument();
  expect(
    screen.queryByText('Media duration is outside feed limits')
  ).toBeNull();
});
