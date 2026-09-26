import { fireEvent, render, screen } from '@testing-library/react';
import SystemHealthPage from '@/app/(dashboard)/platform/system-health/page';
import type { SystemHealthSnapshot } from '@/types/platform/system-health';

const mockReplace = jest.fn();
let mockQuery = '';
const fixture: SystemHealthSnapshot = {
  timestamp: new Date().toISOString(),
  overall: 'degraded',
  services: [
    {
      name: 'aggregation',
      displayName: 'Aggregation',
      endpointUrl: 'http://aggregation.test',
      status: 'degraded',
      httpStatus: 200,
      latencyMs: 5,
      deps: [],
    },
  ],
  issues: [],
  envAudit: [],
};
let mockHealth: {
  data: SystemHealthSnapshot | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: jest.Mock;
};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
  usePathname: () => '/platform/system-health',
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock(
  'next/dynamic',
  () => () =>
    function DeferredPanel() {
      return <div data-testid="deep-diagnostic">Detailed diagnostics</div>;
    }
);
jest.mock('@/hooks/use-system-health', () => ({
  useSystemHealth: () => mockHealth,
}));
jest.mock('@/hooks/use-system-autopilot', () => ({
  useSystemAutopilotStatus: () => ({
    data: {
      state: 'off',
      open_episodes: [],
      registered_autopilots: [],
      latest_run: null,
    },
    isError: false,
  }),
}));
jest.mock('@/components/platform/system-health/service-card', () => ({
  ServiceCard: () => <p>Service detail evidence</p>,
}));

beforeEach(() => {
  mockQuery = '';
  mockReplace.mockClear();
  mockHealth = {
    data: fixture,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  };
});

test('overview mounts no deeper diagnostic panels and preserves URL context when inspecting', () => {
  mockQuery = 'context=kept';
  render(<SystemHealthPage />);
  expect(screen.queryByTestId('deep-diagnostic')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Aggregation' }));
  expect(mockReplace).toHaveBeenCalledWith(
    '/platform/system-health?context=kept&service=aggregation',
    { scroll: false }
  );
});

test('an initial failed request offers retry without an endless skeleton', () => {
  mockHealth = {
    ...mockHealth,
    data: undefined,
    isError: true,
    error: new Error('HTTP 503'),
  };
  render(<SystemHealthPage />);
  expect(screen.getByText('Service checks unavailable')).toBeInTheDocument();
  expect(
    screen.queryByRole('status', { name: 'Loading service checks' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry service checks' }));
  expect(mockHealth.refetch).toHaveBeenCalledTimes(1);
});

test('a failed refresh preserves inspectable evidence with a stale warning', () => {
  mockHealth = { ...mockHealth, isError: true, error: new Error('HTTP 503') };
  render(<SystemHealthPage />);
  expect(screen.getByText('Stale snapshot')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Inspect Aggregation' })
  ).toBeInTheDocument();
});

test('a saved incident tab mounts diagnostics on demand', () => {
  mockQuery = 'tab=incidents';
  render(<SystemHealthPage />);
  expect(
    screen.getByRole('tab', { name: 'Incidents & automation' })
  ).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByTestId('deep-diagnostic')).toBeInTheDocument();
});

test('a saved service selection restores its named inspector', () => {
  mockQuery = 'service=aggregation';
  render(<SystemHealthPage />);
  expect(
    screen.getByRole('dialog', { name: 'Aggregation diagnostics' })
  ).toBeInTheDocument();
  expect(screen.getByText('Service detail evidence')).toBeInTheDocument();
});
