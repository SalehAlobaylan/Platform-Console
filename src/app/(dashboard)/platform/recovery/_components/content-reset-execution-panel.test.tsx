import { fireEvent, render, screen } from '@testing-library/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import ContentResetExecutionPanel from './content-reset-execution-panel';
import type { ContentResetCampaignDetail, ContentResetMilestone } from '@/lib/api/cms/content-reset';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(), useMutation: jest.fn(),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/lib/api/cms/content-reset', () => ({
  controlContentResetCampaign: jest.fn(), getContentResetExecution: jest.fn(),
  issueContentResetReauth: jest.fn(), listContentResetSteps: jest.fn(),
}));

const detail = {
  campaign: { id: 'campaign', tenant_id: 'tenant', lane: 'news' },
  revision: { revision: 1, manifest_hash: 'a'.repeat(64) },
} as ContentResetCampaignDetail;

type SetupOptions = {
  error?: boolean;
  pending?: boolean;
  state?: string;
  retrySafe?: boolean;
  stepsError?: boolean;
  canPublish?: boolean;
  canRollback?: boolean;
  canCleanup?: boolean;
  canResumeIntake?: boolean;
  milestones?: ContentResetMilestone[];
};

function setup({
  error = false, pending = false, state = 'previewed', retrySafe = false, stepsError = false,
  canPublish = false, canRollback = false, canCleanup = false, canResumeIntake = false, milestones = [],
}: SetupOptions = {}) {
  (useQuery as jest.Mock).mockImplementation(({ queryKey }) => queryKey[1] === 'execution' ? {
    isError: error, isPending: false,
    data: {
      state, blockers: [], steps: state === 'partial' ? [{ state: 'failed', count: 1 }] : [],
      execution: state === 'approved' ? { phase: 'approved', version: 1 } : state === 'partial' ? { phase: 'owner_attention', version: 2, pause_requested: true, started_at: '2026-10-02T00:00:00Z' } : state === 'executing' ? { phase: 'awaiting_publication', version: 3, started_at: '2026-10-02T00:00:00Z', published_at: '2026-10-02T01:00:00Z', cleanup_not_before: '2026-10-03T01:00:00Z', cleanup_authorized_until: '2026-10-05T01:00:00Z' } : null,
      milestones, publication_confirmation: 'PUBLISH NEWS 2 ITEMS ABCDEF123456',
      rollback_confirmation: 'ROLLBACK NEWS 2 ITEMS ABCDEF123456',
      resume_intake_confirmation: 'RESUME INTAKE NEWS 2 ITEMS ABCDEF123456',
      can_publish: canPublish, can_rollback: canRollback, can_authorize_cleanup: canCleanup,
      can_resume_intake: canResumeIntake,
    },
  } : { isError: stepsError, data: state === 'partial' ? { data: [{ id: 'step', step_key: 'prepare', owner: 'cms/content-reset', effect: 'prepare', state: 'failed', retry_safe: retrySafe }], has_more: false } : undefined });
  (useMutation as jest.Mock).mockReturnValue({ isPending: pending, mutate: jest.fn() });
  render(<ContentResetExecutionPanel detail={detail} />);
}

describe('Content Reset execution controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('permits approval review when current status has no blockers', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeEnabled();
  });

  it('disables controls when a status refresh failed despite cached data', () => {
    setup({ error: true, state: 'approved' });
    expect(screen.getByRole('alert')).toHaveTextContent('Execution status is unavailable');
    expect(screen.getByRole('button', { name: 'Start approved reset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revoke approval' })).toBeDisabled();
  });

  it('prevents replacing the selected decision while it is being submitted', () => {
    setup({ pending: true });
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
  });

  it('shows retry only for a proved absence and keeps resume blocked', () => {
    setup({ state: 'partial', retrySafe: true });
    expect(screen.getByRole('button', { name: 'Review resume' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Review safe retry' }));
    expect(screen.getByText('Action: prepare')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm your password')).toBeRequired();
  });

  it('hides retry for an admitted or unproved failure', () => {
    setup({ state: 'partial' });
    expect(screen.queryByRole('button', { name: 'Review safe retry' })).not.toBeInTheDocument();
  });

  it('disables cached retry proof after owner actions fail to refresh', () => {
    setup({ state: 'partial', retrySafe: true, stepsError: true });
    expect(screen.getByRole('button', { name: 'Review safe retry' })).toBeDisabled();
  });

  it('offers publication review only when the server confirms readiness', () => {
    setup({ state: 'executing', canPublish: true });
    const publish = screen.getByRole('button', { name: 'Review publication' });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    expect(screen.getByLabelText(/Type PUBLISH NEWS 2 ITEMS ABCDEF123456/)).toBeRequired();
  });

  it('offers rollback review while the recovery window is open', () => {
    setup({ state: 'executing', canRollback: true });
    fireEvent.click(screen.getByRole('button', { name: 'Review rollback' }));
    expect(screen.getByLabelText(/Type ROLLBACK NEWS 2 ITEMS ABCDEF123456/)).toBeRequired();
  });

  it('offers the reviewed intake resume only for a completed Empty campaign', () => {
    setup({ state: 'complete', canResumeIntake: true });
    fireEvent.click(screen.getByRole('button', { name: 'Review intake resume' }));
    expect(screen.getByLabelText(/Type RESUME INTAKE NEWS 2 ITEMS ABCDEF123456/)).toBeRequired();
  });

  it('offers cleanup renewal only after cleanup authorization expired', () => {
    setup({
      state: 'executing', canCleanup: true,
      milestones: [{
        id: 'm', kind: 'publication', state: 'active', manifest_hash: 'a'.repeat(64),
        approved_by: 'admin', approved_at: '2026-10-02T00:30:00Z', expires_at: '2026-10-02T06:30:00Z',
      }],
    });
    expect(screen.queryByRole('button', { name: 'Renew cleanup authorization' })).not.toBeInTheDocument();
    expect(screen.getByText(/Publication approved by admin/)).toBeInTheDocument();
  });
});
