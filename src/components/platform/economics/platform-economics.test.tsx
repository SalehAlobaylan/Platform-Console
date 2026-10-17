import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformEconomics } from './platform-economics';
import {
  ResourceTable,
  Trend,
  resourceUsage,
} from './platform-economics-shared';
import { useAuthStore } from '@/lib/stores/auth';
import { economicsAPI } from '@/lib/api/cms/platform-economics';
import type {
  AccountDetail,
  ReportRow,
} from '@/lib/api/cms/platform-economics';

jest.mock('@/lib/api/cms/platform-economics', () => ({
  economicsAPI: {
    accounts: jest.fn(),
    account: jest.fn(),
    directory: jest.fn(),
    overview: jest.fn(),
    policy: jest.fn(),
    sources: jest.fn(),
    costs: jest.fn(),
    breakdown: jest.fn(),
    coverage: jest.fn(),
    profiles: jest.fn(),
    runs: jest.fn(),
    run: jest.fn(),
    issues: jest.fn(),
  },
}));
const api = jest.mocked(economicsAPI);
const id = '11111111-1111-4111-8111-111111111111';
const period = { from: '2026-10-01', to: '2026-10-17' };
const row = (key: string, total: string | null): ReportRow => ({
  key,
  total,
  direct: total,
  shared: total === null ? null : '0',
  reconciled: false,
});
function mount(view: 'users' | 'activity' | 'billing' | 'overview' = 'users') {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PlatformEconomics view={view} period={period} />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  api.accounts.mockResolvedValue({
    ...period,
    revision: 'r1',
    as_of: '2026-10-16T10:00:00Z',
    currency: 'USD',
    coverage: 'partial',
    accounts: [
      {
        account_id: id,
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
    next_cursor: null,
    offset: 0,
  });
  api.directory.mockResolvedValue({
    users: [{ id, username: 'Reader One', email: 'reader@example.test' }],
    has_more: false,
  });
  api.account.mockResolvedValue({
    ...period,
    revision: 'r1',
    as_of: '2026-10-16T10:00:00Z',
    currency: 'USD',
    coverage: 'partial',
    account_id: id,
    total: { ...row('total', '3'), direct: '1', shared: '2' },
    resources: [
      { ...row('database', '3'), methods: 'calibrated_resource_profile' },
    ],
    activities: [row('news', '3')],
    trend: [],
    usage: [{ operation: 'news_page', unit: 'requests', value: 42 }],
    requested_work: [
      {
        provider: 'fixture',
        resource: 'ai',
        feature: 'transcription',
        content_id: 'content',
        amount: '9',
        benefit: 'shared_content',
        occurred_at: '2026-10-15T10:00:00Z',
      },
    ],
    efficiency_metrics: [],
    comparisons: {
      observed_media_seconds: 0,
      distinct_story_opens: 0,
      cost_per_hour: null,
      cost_per_story: null,
      reason: 'Insufficient comparable usage',
    },
    note: 'Shared estimates are not savings from removing this account',
  } as AccountDetail);
});

test('opens resource-first account evidence with one selection and keeps requested work separate', async () => {
  mount();
  await userEvent.click(
    await screen.findByRole('button', { name: /Reader One/ })
  );
  const dialog = await screen.findByRole('dialog');
  expect(
    await within(dialog).findByText(
      'API workload proxy; query count unavailable'
    )
  ).toBeInTheDocument();
  expect(within(dialog).getByText('42 requests')).toBeInTheDocument();
  await userEvent.click(
    within(dialog).getByText('Activities, efficiency & evidence')
  );
  expect(
    within(dialog).getByText(/separate from the account total/)
  ).toBeInTheDocument();
  expect(api.account).toHaveBeenCalledWith(id, period);
  expect(within(dialog).getAllByText('$3.00').length).toBeGreaterThan(0);
});
test('uses bounded IAM search results as CMS account filters', async () => {
  mount();
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Search name, email or account ID' }),
    'Reader'
  );
  await waitFor(() => expect(api.directory).toHaveBeenCalledWith('Reader'));
  await waitFor(() =>
    expect(api.accounts).toHaveBeenCalledWith(period, '', 'cost', undefined, id)
  );
});
test('keeps account investigation usable with identity directory unavailable', async () => {
  api.directory.mockRejectedValue(new Error('IAM unavailable'));
  mount();
  await userEvent.click(
    await screen.findByRole('button', { name: new RegExp(id) })
  );
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
test('shows unavailable costs separately from supported zero', () => {
  render(<ResourceTable rows={[row('database', null), row('storage', '0')]} />);
  expect(screen.getAllByText('Unavailable')).toHaveLength(3);
  expect(screen.getAllByText('$0.00')).toHaveLength(3);
});
test('keeps errors visible without showing an empty account list as success', async () => {
  api.accounts.mockRejectedValue(
    new Error('Account reports await lifecycle synchronization')
  );
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'lifecycle synchronization'
  );
  expect(
    screen.queryByText('No observed accounts in this period')
  ).not.toBeInTheDocument();
});
test('refund trend has a signed baseline and accessible exact values', async () => {
  render(<Trend rows={[row('2026-10-14', '5'), row('2026-10-15', '-2')]} />);
  expect(screen.getByRole('img')).toHaveAccessibleName(
    /refunds extend below zero/
  );
  await userEvent.click(screen.getByText('View trend values'));
  expect(screen.getByText('-$2.00')).toBeInTheDocument();
});
test('resource units do not invent database queries or media delivery bytes', () => {
  expect(
    resourceUsage('database', [
      { operation: 'search', unit: 'requests', value: 7 },
    ])
  ).toBe('7 requests');
  expect(
    resourceUsage('delivery', [
      { operation: 'playback', unit: 'media_seconds', value: 90 },
    ])
  ).toBe('Unavailable');
});

test('preserves structured API reasons instead of hiding lifecycle failures', async () => {
  api.accounts.mockRejectedValue({
    message: 'Account reports await IAM lifecycle synchronization',
    status: 503,
  });
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'IAM lifecycle synchronization'
  );
});
test('does not reuse another tenant account cache when the administrator changes scope', async () => {
  const other = '33333333-3333-4333-8333-333333333333';
  act(() =>
    useAuthStore.setState({
      user: {
        id: 'operator',
        email: 'operator@example.test',
        role: 'admin',
        tenant_id: 'a',
      },
    })
  );
  mount();
  await screen.findByRole('button', { name: new RegExp(id) });
  api.accounts.mockResolvedValue({
    ...period,
    revision: 'r2',
    as_of: null,
    currency: 'USD',
    coverage: 'partial',
    accounts: [
      {
        account_id: other,
        driver: null,
        direct: null,
        shared: null,
        total: null,
        requests: 1,
        errors: 0,
        reconciled: false,
      },
    ],
    total: 1,
    offset: 0,
    next_cursor: null,
  });
  act(() =>
    useAuthStore.setState({
      user: {
        id: 'operator',
        email: 'operator@example.test',
        role: 'admin',
        tenant_id: 'b',
      },
    })
  );
  await screen.findByRole('button', { name: new RegExp(other) });
  expect(
    screen.queryByRole('button', { name: new RegExp(id) })
  ).not.toBeInTheDocument();
  act(() => useAuthStore.setState({ user: null }));
});

test('exposes imported provider resource evidence without treating it as an invoice', async () => {
  api.sources.mockResolvedValue({
    sources: [
      {
        id: 'source',
        provider: 'Neon',
        resource: 'database',
        scope: 'fixture project',
        currency: 'USD',
        capability: 'neon_consumption',
        status: 'usage_only',
        note: 'Usage only',
      },
    ],
    usage_evidence: [
      {
        source_id: 'source',
        from: '2026-10-15T00:00:00Z',
        to: '2026-10-16T00:00:00Z',
        observed_at: '2026-10-16T10:00:00Z',
        metrics: [{ name: 'compute_unit_seconds', value: '123.125' }],
      },
    ],
  });
  api.costs.mockResolvedValue({ costs: [] });
  mount('billing');
  await userEvent.click(await screen.findByText('Imported resource evidence'));
  expect(screen.getByText('123.125')).toBeVisible();
  expect(screen.getByText(/Provider resource usage only/)).toBeVisible();
  expect(screen.getByText('compute unit seconds')).toBeVisible();
});

test('describes a checkpointed build without claiming that a report was published', async () => {
  api.policy.mockResolvedValue({
    collection_enabled: false,
    reports_enabled: true,
    imports_enabled: false,
    allocation_enabled: false,
  });
  api.overview.mockRejectedValue(new Error('Fixture report unavailable'));
  api.run.mockResolvedValue({ published: false });
  mount('overview');
  const button = await screen.findByRole('button', { name: 'Update report' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  expect(
    await screen.findByText(/Report build checkpoint saved/)
  ).toHaveTextContent('previous complete report remains visible');
  expect(
    screen.queryByText('Published updated economics reports')
  ).not.toBeInTheDocument();
});

it('separates captured data from completion time and warns on the capture age', async () => {
  api.accounts.mockResolvedValueOnce({
    ...(await api.accounts(period, "", "cost")),
    as_of: '2026-10-16T10:00:00Z',
    published_at: new Date().toISOString(),
  } as never);
  mount();
  expect(
    await screen.findByText(/Data captured.*Published/)
  ).toBeInTheDocument();
  expect(
    await screen.findByText('Older data snapshot; review Diagnostics')
  ).toBeInTheDocument();
});
