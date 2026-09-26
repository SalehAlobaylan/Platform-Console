import { render, screen } from '@testing-library/react';
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

jest.mock('@/hooks/use-system-autopilot', () => ({
  useSystemIncidentEpisodes: () => ({ data: { items: [] }, isLoading: false }),
  useSystemIncidentEpisode: () => ({ data: mockDetail, isLoading: false }),
}));

describe('Incident investigation', () => {
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
});
