import { render, screen } from '@testing-library/react';
import { SystemAutopilotPanel } from '../platform/system-health/system-autopilot-panel';
import type { SystemAutopilotStatus } from '@/types/platform/system-autopilot';

let mockStatus: SystemAutopilotStatus;
const mockMutation = { mutate: jest.fn(), isPending: false };
jest.mock('@/hooks/use-system-autopilot', () => ({
  useSystemAutopilotStatus: () => ({
    data: mockStatus,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useUpdateSystemAutopilotPolicy: () => mockMutation,
  useRunSystemAutopilotNow: () => mockMutation,
  usePauseSystemAutopilotContainment: () => mockMutation,
  useCloseSystemIncidentEpisode: () => mockMutation,
}));
jest.mock('../platform/system-health/system-incident-history-sheet', () => ({
  SystemIncidentHistorySheet: () => null,
}));
jest.mock('../platform/system-health/system-autopilot-runs-sheet', () => ({
  SystemAutopilotRunsSheet: () => null,
}));
jest.mock('../platform/system-health/system-autopilot-policy-sheet', () => ({
  SystemAutopilotPolicySheet: () => null,
}));

beforeEach(() => {
  mockStatus = {
    policy: {
      scope: 'platform',
      enabled: false,
      mode: 'observe',
      interval_minutes: 10,
      confirm_probes: 2,
      resolve_probes: 3,
      flap_cycles_24h: 3,
      containment_ttl_minutes: 60,
    },
    state: 'off',
    open_episodes: [],
    registered_autopilots: [],
  };
});

test('absent additive containment fields remain unreported rather than zero', () => {
  render(<SystemAutopilotPanel />);
  expect(
    screen.getByText('Containment has not been reported by CMS')
  ).toBeInTheDocument();
  expect(screen.queryByText('0 active · 0 pending')).not.toBeInTheDocument();
});

test('uses the current CMS outcome instead of a historical containment headline', () => {
  mockStatus.latest_run = {
    id: 'run',
    trigger: 'scheduled',
    mode: 'safe_auto',
    status: 'completed',
    headline: 'contained',
    started_at: '2026-10-18T10:00:00Z',
    summary: 'Old containment applied',
  };
  mockStatus.outcome = {
    headline: 'release_pending',
    summary: 'No active leases; legacy ownership needs review',
  };
  render(<SystemAutopilotPanel />);
  expect(screen.getByText('Containment needs review')).toBeInTheDocument();
  expect(
    screen.getByText('No active leases; legacy ownership needs review')
  ).toBeInTheDocument();
  expect(screen.queryByText('Containment active')).not.toBeInTheDocument();
});

test('attention supplies evidence time, accountable role and a concrete next step', () => {
  mockStatus.attention = [
    {
      target: 'enrichment',
      status: 'attention',
      reason: 'Ownership conflict',
      at: '2026-10-18T10:00:00Z',
      responsible_role: 'Platform administrator',
      recommended_action: {
        href: '/platform/enrichment',
        label: 'Review Enrichment policy and receipts',
        target: 'enrichment',
        kind: 'inspect',
      },
    },
  ];
  render(<SystemAutopilotPanel />);
  expect(
    screen.getByText(/Platform administrator.*Evidence:/)
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Review Enrichment policy and receipts' })
  ).toHaveAttribute('href', '/platform/enrichment');
});

test('shows total incidents independently of the bounded preview and labels Pipeline scope', () => {
  mockStatus.open_episode_count = 12;
  mockStatus.open_episodes = [
    {
      id: 'episode',
      root_service: 'aggregation',
      verdict: 'service_down',
      status: 'open',
      severity: 'critical',
      summary: 'Unavailable',
      first_detected_at: '2026-10-18T10:00:00Z',
      last_seen_at: '2026-10-18T10:00:00Z',
    },
  ];
  mockStatus.registered_autopilots = [
    {
      id: 'pipeline',
      key: 'pipeline',
      label: 'Pipeline',
      dependencies: ['aggregation'],
      containment_enabled: true,
    },
  ];
  render(<SystemAutopilotPanel />);
  expect(
    screen.getByText(/Showing 1 of 12 active incidents/)
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Observe-only cockpit pause; canonical pipeline repairs are not stopped/
    )
  ).toBeInTheDocument();
});
