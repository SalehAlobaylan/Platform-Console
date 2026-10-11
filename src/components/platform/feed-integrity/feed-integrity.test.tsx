import { render, screen, fireEvent } from '@testing-library/react';
import { FeedIntegrityAutopilotPanel } from './feed-integrity-autopilot-panel';
import * as hooks from '@/hooks/use-feed-integrity';
jest.mock('@/hooks/use-feed-integrity');
const mutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false };
beforeEach(() => {
  jest.clearAllMocks();
  (hooks.useFeedIntegrityAutopilotStatus as jest.Mock).mockReturnValue({
    data: { policy: { autopilot_enabled: true, autopilot_mode: 'assist' } },
    isError: false,
  });
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    data: { items: [] },
    isError: false,
  });
  for (const key of [
    'useApproveFeedIntegrityAction',
    'useRejectFeedIntegrityAction',
    'useReviewFeedIntegrityUnknownAction',
    'useUpdateFeedIntegrityAutopilotPolicy',
    'usePauseFeedIntegrityAutopilot',
  ] as const)
    (hooks[key] as jest.Mock).mockReturnValue(mutation);
});
it('offers only Observe and Assist settings', () => {
  render(<FeedIntegrityAutopilotPanel settings />);
  expect(
    screen.getByRole('button', { name: /^Record recommendations/ })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /^Allow reviewed repairs/ })
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Safe Auto' })).toBeNull();
});
it('shows unavailable history independently from empty success', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    isError: true,
    error: new Error('connection failed'),
  });
  render(<FeedIntegrityAutopilotPanel />);
  expect(screen.getByRole('alert')).toHaveTextContent('connection failed');
  expect(screen.queryByText('No repair decisions recorded.')).toBeNull();
});
it('requires evidence review and a note before approval', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    data: {
      items: [
        {
          id: 'a',
          action_class: 'news_snapshot.refresh_window',
          target_scope: 'today',
          owner_system: 'CMS',
          outcome: 'approval_required',
          input: { evidence: { dirty: true } },
          created_at: '2026-10-10',
        },
      ],
    },
  });
  render(<FeedIntegrityAutopilotPanel />);
  fireEvent.click(
    screen.getByRole('button', { name: /Refresh News snapshot/ })
  );
  expect(
    screen.getByRole('button', { name: 'Approve this repair' })
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Repair review note'), {
    target: { value: 'Reviewed current debt' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Approve this repair' }));
  expect(mutation.mutate).toHaveBeenCalledWith(
    { id: 'a', reason: 'Reviewed current debt' },
    expect.anything()
  );
});
it('keeps uncertain effects visible and offers reviewed dispositions', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    data: {
      items: [
        {
          id: 'a',
          action_class: 'news_snapshot.refresh_window',
          target_scope: 'week',
          outcome: 'tool_failed',
          error_class: 'effect_unknown',
          created_at: '2026-10-10',
        },
      ],
    },
  });
  render(<FeedIntegrityAutopilotPanel />);
  fireEvent.click(
    screen.getByRole('button', { name: /Refresh News snapshot/ })
  );
  expect(screen.getByRole('button', { name: 'Record review' })).toBeDisabled();
  expect(screen.getByLabelText('Unknown effect disposition')).toHaveValue(
    'keep_blocked'
  );
  expect(
    screen.queryByRole('button', { name: 'Approve this repair' })
  ).toBeNull();
});

it('preserves legacy owner referrals without offering snapshot approval', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    data: {
      items: [
        {
          id: 'legacy',
          action_class: 'storage.inspect',
          target_scope: 'content:a',
          outcome: 'approval_required',
          created_at: '2026-10-10',
          input: { deep_link: '/platform/storage' },
        },
      ],
    },
  });
  render(<FeedIntegrityAutopilotPanel />);
  fireEvent.click(screen.getByRole('button', { name: /Investigate in/ }));
  expect(
    screen.getByRole('heading', { name: 'Owner referral' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Open responsible system' })
  ).toHaveAttribute('href', '/platform/storage');
  expect(
    screen.queryByRole('button', { name: 'Approve this repair' })
  ).toBeNull();
  expect(screen.queryByText(/Expected effect: refresh/)).toBeNull();
});

it('puts only executable proposals and uncertain effects in pending reviews', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    data: {
      items: [
        {
          id: 'ready',
          action_class: 'news_snapshot.refresh_window',
          target_scope: 'today',
          outcome: 'approval_required',
        },
        {
          id: 'done',
          action_class: 'news_snapshot.refresh_window',
          target_scope: 'week',
          outcome: 'verification_passed',
        },
        {
          id: 'referral',
          action_class: 'storage.inspect',
          target_scope: 'content:a',
          outcome: 'approval_required',
        },
      ],
    },
  });
  render(<FeedIntegrityAutopilotPanel view="pending" />);
  expect(
    screen.getAllByRole('button', { name: /Refresh News snapshot/ })
  ).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /Investigate in/ })).toBeNull();
});

it('updates an open review from the polled ledger instead of preserving stale approval', () => {
  let action = {
    id: 'a',
    action_class: 'news_snapshot.refresh_window',
    target_scope: 'today',
    outcome: 'approval_required',
  };
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockImplementation(
    () => ({ data: { items: [action] } })
  );
  const { rerender } = render(<FeedIntegrityAutopilotPanel selectedId="a" />);
  expect(
    screen.getByRole('button', { name: 'Approve this repair' })
  ).toBeInTheDocument();
  action = { ...action, outcome: 'expired' };
  rerender(<FeedIntegrityAutopilotPanel selectedId="a" />);
  expect(
    screen.queryByRole('button', { name: 'Approve this repair' })
  ).toBeNull();
  expect(screen.getAllByText('Review expired').length).toBeGreaterThan(0);
});

it('disables repair decisions when fresh ledger evidence is unavailable', () => {
  (hooks.useFeedIntegrityAutopilotActions as jest.Mock).mockReturnValue({
    isError: true,
    error: new Error('offline'),
    data: {
      items: [
        {
          id: 'a',
          action_class: 'news_snapshot.refresh_window',
          target_scope: 'today',
          outcome: 'approval_required',
        },
      ],
    },
  });
  render(<FeedIntegrityAutopilotPanel selectedId="a" />);
  fireEvent.change(screen.getByLabelText('Repair review note'), {
    target: { value: 'Reviewed' },
  });
  expect(
    screen.getByRole('button', { name: 'Approve this repair' })
  ).toBeDisabled();
});
