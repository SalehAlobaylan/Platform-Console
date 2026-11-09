import React from 'react';
import { render, screen } from '@testing-library/react';
import OperationsPage from '@/app/(dashboard)/platform/operations/page';
import * as hooks from '@/hooks/use-operations-command-center';
jest.mock('@/hooks/use-operations-command-center');
jest.mock('@/lib/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../attention-inbox', () => ({
  AttentionInbox: () => <div>Retained attention surface</div>,
}));
jest.mock('../fleet-status', () => ({
  FleetStatus: () => <div>Retained fleet surface</div>,
}));
jest.mock('../shift-history', () => ({
  ShiftBriefing: () => <div />,
  RunCalendar: () => <div />,
}));
jest.mock('../command-history', () => ({ CommandHistory: () => <div /> }));
const now = Date.parse('2026-10-29T12:00:00Z');
function status(extra = {}) {
  return {
    data: {
      as_of: new Date(now).toISOString(),
      headline: 'all_clear',
      summary: 'Recorded fleet snapshot',
      fleet: [],
      attention_counts: {},
      adapter_errors: [],
      complete: true,
      pause_targets_readable: true,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...extra,
  } as unknown as ReturnType<typeof hooks.useOpsStatus>;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hooks.useOpsClock).mockReturnValue(now);
  jest
    .mocked(hooks.useOpsRegistry)
    .mockReturnValue({ isError: false } as ReturnType<
      typeof hooks.useOpsRegistry
    >);
});
it('retains the last successful page and disables commands on refresh failure', () => {
  jest.mocked(hooks.useOpsStatus).mockReturnValue(status({ isError: true }));
  render(<OperationsPage />);
  expect(screen.getByText('Retained attention surface')).toBeInTheDocument();
  expect(screen.getByText('Retained fleet surface')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'last successful snapshot remains visible'
  );
  expect(
    screen.getByRole('button', { name: 'Review fleet pause' })
  ).toBeDisabled();
  expect(screen.getByText('unknown')).toBeInTheDocument();
});
it('does not block a readable pause roster because an unrelated attention adapter is unavailable', () => {
  const result = status();
  result.data!.complete = false;
  result.data!.adapter_errors = ['storage attention unavailable'];
  jest.mocked(hooks.useOpsStatus).mockReturnValue(result);
  render(<OperationsPage />);
  expect(
    screen.getByRole('button', { name: 'Review fleet pause' })
  ).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Pause targets remain readable'
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent(
    'Fleet-wide pause is disabled'
  );
});
it('blocks the fleet review when a pause target is unreadable', () => {
  const result = status();
  result.data!.pause_targets_readable = false;
  jest.mocked(hooks.useOpsStatus).mockReturnValue(result);
  render(<OperationsPage />);
  expect(
    screen.getByRole('button', { name: 'Review fleet pause' })
  ).toBeDisabled();
});
it('provides direct navigation to every operator section', () => {
  jest.mocked(hooks.useOpsStatus).mockReturnValue(status());
  render(<OperationsPage />);
  for (const [name, id] of [
    ['Inbox', 'attention'],
    ['Fleet', 'fleet'],
    ['Briefing', 'briefing'],
    ['Calendar', 'calendar'],
    ['Commands', 'commands'],
  ]) {
    expect(screen.getByRole('link', { name })).toHaveAttribute(
      'href',
      `#ops-${id}`
    );
    expect(document.getElementById(`ops-${id}`)).toBeInTheDocument();
  }
});
