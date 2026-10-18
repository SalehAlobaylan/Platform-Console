import { act, fireEvent, render, screen } from '@testing-library/react';
import { SystemIncidentHistorySheet } from '../platform/system-health/system-incident-history-sheet';

const mockDetail = {
  episode: {
    id: 'incident',
    root_service: 'aggregation',
    status: 'recovering',
    summary: 'Dependency recovering',
    timeline: [],
  },
  actions: [
    {
      id: 'action',
      target: 'pipeline',
      action: 'pause_sibling',
      status: 'success',
      reason: 'Pause applied',
      started_at: '2026-09-26T12:00:00Z',
      output: { tenant_id: 'tenant-one', paused_until: '2026-09-26T13:00:00Z' },
    },
  ],
  recommended_action: {
    href: '/platform/pipeline',
    label: 'Inspect Pipeline operations',
  },
  containment: {
    targets: [
      {
        episode_id: 'incident',
        sibling: 'pipeline',
        tenant_id: 'tenant-one',
        outcome: 'release_pending',
        until: '2026-09-26T13:00:00Z',
        reason: 'Release requires current authority',
      },
    ],
  },
  recovery: {
    healthy_samples: 2,
    required_samples: 3,
    evidence_fresh: true,
    reason: 'One more healthy observation required',
    next_check_at: '2026-09-26T12:10:00Z',
  },
};

let mockDetailError = false;
let mockDetailUpdatedAt = 0;
const mockRefetch = jest.fn();
let mockHistory = [
  { ...mockDetail.episode, id: 'other', summary: 'Other incident in history' },
];
jest.mock('@/hooks/use-system-autopilot', () => ({
  useSystemIncidentEpisodes: () => ({
    data: { items: mockHistory },
    isLoading: false,
  }),
  useSystemIncidentEpisode: () => ({
    data: mockDetail,
    isLoading: false,
    isError: mockDetailError,
    dataUpdatedAt: mockDetailUpdatedAt,
    refetch: mockRefetch,
  }),
}));

describe('Incident investigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
    mockDetailError = false;
    mockDetailUpdatedAt = Date.now();
    mockRefetch.mockClear();
    mockHistory = [];
    mockDetail.containment.targets[0].outcome = 'release_pending';
    mockDetail.containment.targets[0].reason =
      'Release requires current authority';
  });
  afterEach(() => jest.useRealTimers());
  it('shows CMS recovery progress, tenant ownership and exact action evidence', () => {
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
      />
    );
    expect(screen.getByText('Recovery check 2 of 3')).toBeInTheDocument();
    expect(
      screen.getByText('One more healthy observation required')
    ).toBeInTheDocument();
    expect(screen.getByText(/pipeline · Release pending/)).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Containment targets' })
    ).toHaveTextContent('tenant-one');
    expect(
      screen.getByText(/Target: pipeline · Tenant: tenant-one/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Inspect Pipeline operations' })
    ).toHaveAttribute('href', '/platform/pipeline');
  });

  it('labels expired leases without claiming an active pause', () => {
    mockDetail.containment.targets[0].outcome = 'expired';
    mockDetail.containment.targets[0].reason =
      'The containment lease has expired';
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
      />
    );
    expect(screen.getByText(/pipeline · Lease expired/)).toBeInTheDocument();
    expect(
      screen.queryByText(/New automation work is paused/)
    ).not.toBeInTheDocument();
  });

  it('stops claiming protection when a cached pause expires while open', () => {
    mockDetail.containment.targets[0].outcome = 'paused';
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
      />
    );
    expect(screen.getByText(/pipeline · Pause active/)).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(60 * 60 * 1000));
    expect(screen.getByText(/pipeline · Lease expired/)).toBeInTheDocument();
    expect(
      screen.queryByText(/pipeline · Pause active/)
    ).not.toBeInTheDocument();
  });

  it('preserves incident evidence after refresh failure and offers retry', () => {
    mockDetailError = true;
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
      />
    );
    expect(screen.getByText(/Incident evidence is stale/)).toBeInTheDocument();
    expect(
      screen.getByText('Recovery evidence is not current')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Containment targets' })
    ).toHaveTextContent('tenant-one');
    fireEvent.click(screen.getByRole('button', { name: 'Retry incident' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('opens selected incident evidence before the history list and supports returning to history', () => {
    mockHistory = [
      {
        ...mockDetail.episode,
        id: 'other',
        summary: 'Other incident in history',
      },
    ];
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
      />
    );
    expect(screen.getByText('Dependency recovering')).toBeInTheDocument();
    expect(
      screen.queryByText('Other incident in history')
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to incident history' })
    );
    expect(screen.getByText('Other incident in history')).toBeInTheDocument();
    expect(screen.queryByText('Recovery check 2 of 3')).not.toBeInTheDocument();
  });

  it('offers authored closure only as a secondary action inside selected detail', () => {
    const close = jest.fn();
    render(
      <SystemIncidentHistorySheet
        open
        onOpenChange={jest.fn()}
        selectedId="incident"
        onCloseIncident={close}
      />
    );
    fireEvent.click(screen.getByText('Administrative actions'));
    fireEvent.click(screen.getByRole('button', { name: 'Close incident' }));
    expect(close).toHaveBeenCalledWith(mockDetail.episode);
    expect(
      screen.getByText(/An authored reason is required/)
    ).toBeInTheDocument();
  });
});
