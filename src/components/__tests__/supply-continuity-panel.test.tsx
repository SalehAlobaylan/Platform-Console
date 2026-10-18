import { render, screen } from '@testing-library/react';
import { SupplyContinuityPanel } from '@/components/platform/media/circulation/supply-continuity-panel';
import type { MediaSupplyStatusResponse } from '@/types/platform/media-circulation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderSupply(node: React.ReactElement) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const status: MediaSupplyStatusResponse = {
  exposure: { schema_version: 'pods-exposure/v2', generated_at: '2026-08-09T12:00:00Z', verdict: 'return_path_observed', evidence_completeness: 'complete', base_eligible_count: 8, reachable_count: 8, returned_count: 8, distinct_returned_count: 8, eligible_returned_gap: 0, repeat_pressure: 0, probe_id: '00000000-0000-4000-8000-000000000001', returned_ids: [], rendered_ids: [], viewed_ids: [], unknowns: [] },
  supply_evaluation: {
    schema_version: 'media-supply/v1',
    evaluated_at: '2026-08-09T12:00:00Z',
    verdict: 'source_due_not_admitted',
    headline_boundary: 'cms_admission',
    owner: 'CMS source-run scheduler',
    evidence_completeness: 'partial',
    read_only: true,
    summary: 'One source is due without a CMS source run.',
    counts: {
      due_unadmitted: 1,
      in_flight: 0,
      scheduled: 3,
      paused: 0,
      schedule_unknown: 0,
      delivery_verified: 2,
      delivery_pending: 1,
      delivery_degraded: 0,
      delivery_unknown: 0,
	  no_upstream_change: 0,
	  upstream_deferred: 0,
	  intake_blocked: 0,
    },
    affected_source_ids: ['11111111-1111-4111-8111-111111111111'],
    affected_request_ids: ['22222222-2222-4222-8222-222222222222'],
    unknowns: ['Additional source schedules are outside the bounded sample.'],
  },
  schedules: {
    generated_at: '2026-08-09T12:00:00Z',
    available: true,
    due_unadmitted: 1,
    in_flight: 0,
    scheduled: 3,
    paused: 0,
    unknown: 0,
    items: [],
  },
  delivery: {
    generated_at: '2026-08-09T12:00:00Z',
    verified: 2,
    pending: 1,
    degraded: 0,
    not_observed: 0,
    items: [],
  },
  evaluator: {
    recording_enabled: true,
    worker_state: 'ready',
    worker_last_heartbeat_at: '2026-08-09T12:00:00Z',
    worker_stale_after_at: '2026-08-09T12:15:00Z',
    last_outcome: 'evaluated',
    last_trigger: 'scheduled',
    last_observed_at: '2026-08-09T12:00:00Z',
    last_evaluated_at: '2026-08-09T12:00:00Z',
    evaluation_digest: 'c'.repeat(64),
    unknowns: [],
  },
  operational: {
    state: 'ready',
    workers: { source_run_scheduler: 'ready', receipt_projection: 'ready' },
	owners: {
	  aggregation: { state: 'ready', observed_at: '2026-08-09T12:00:00Z', stale_after_at: '2026-08-09T12:15:00Z' },
	  media: { state: 'ready', observed_at: '2026-08-09T12:00:00Z', stale_after_at: '2026-08-09T12:15:00Z' },
	  enrichment: { state: 'ready', observed_at: '2026-08-09T12:00:00Z', stale_after_at: '2026-08-09T12:15:00Z' },
	},
    backlogs: { projection_pending: 0, retained_receipts: 0, episodes_open: 0 },
	metrics: { schema_version: 'media-supply-operational-metrics/v1' as const, generated_at: '2026-08-09T12:00:00Z', samples: [], truncated: false, unknowns: [] },
    unknowns: [],
    generated_at: '2026-08-09T12:00:00Z',
  },
};

describe('SupplyContinuityPanel', () => {
  it('renders CMS evidence and does not invent a recovery action', () => {
    renderSupply(
      <SupplyContinuityPanel
        status={status}
        loading={false}
        onInspectRequest={jest.fn()}
      />
    );
    expect(
      screen.getByRole('heading', { name: 'Where new Pods supply stops' })
    ).toBeInTheDocument();
    expect(screen.getByText('Due without CMS run')).toBeInTheDocument();
    expect(screen.getByText('What CMS cannot prove')).toBeInTheDocument();
    expect(screen.getByText(/CMS evaluator · Recording enabled · Loop ready/)).toBeInTheDocument();
    expect(screen.getByText(/Outcome: evaluated/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Trace 22222222/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retry|repair|run now/i })
    ).not.toBeInTheDocument();
    const operatorLaunch = screen.getByRole('button', { name: 'Investigate in Operator' });
    expect(operatorLaunch).toBeEnabled();
  });

  it('renders an explicit unavailable state for malformed or absent CMS evidence', () => {
    renderSupply(
      <SupplyContinuityPanel
        loading={false}
        statusError={
          new Error('CMS returned an invalid Media Supply status payload')
        }
      />
    );
    expect(
      screen.getByText('CMS supply evidence is unavailable')
    ).toBeInTheDocument();
  });

	 it('renders a stale declared owner as an unavailable action boundary', () => {
		 const degraded = {
			 ...status,
			 operational: {
				 ...status.operational,
				 state: 'degraded' as const,
				 owners: { ...status.operational.owners, media: { state: 'stale' as const, detail: 'Media ARQ worker is not live' } },
			 },
		 };
		 renderSupply(<SupplyContinuityPanel status={degraded} loading={false} />);
		 expect(screen.getByText((_, element) => element?.textContent === 'Action owner unavailable: media · Media ARQ worker is not live')).toBeInTheDocument();
		 expect(screen.getByText(/Media ARQ worker is not live/)).toBeInTheDocument();
	 });

  it('labels a CMS-resolved episode as verified recovery rather than hiding it', () => {
    renderSupply(
      <SupplyContinuityPanel
        status={status}
        loading={false}
        episodes={{
          schema_version: 'media-supply/v1',
          next_cursor: '',
          items: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              tenant_id: 'tenant-a',
              fingerprint: 'a'.repeat(64),
              first_failed_boundary: 'cms_admission',
              verdict: 'source_due_not_admitted',
              severity: 'major',
              owner: 'CMS source-run scheduler',
              state: 'resolved',
              summary: 'A previously due source is now admitted.',
              affected_subjects: [],
              evidence_digest: 'b'.repeat(64),
              evidence_completeness: 'complete',
              evidence: {},
              first_seen_at: '2026-08-09T11:00:00Z',
              last_seen_at: '2026-08-09T11:30:00Z',
              resolved_at: '2026-08-09T12:00:00Z',
              resolution_proof: { schema_version: 'media-supply-resolution/v1' },
              created_at: '2026-08-09T11:00:00Z',
              updated_at: '2026-08-09T12:00:00Z',
            },
          ],
        }}
      />
    );
    expect(screen.getByText(/Verified recovery/)).toBeInTheDocument();
  });
});
