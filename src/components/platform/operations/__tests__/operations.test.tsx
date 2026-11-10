import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttentionInbox } from '../attention-inbox';
import { OpsCommandDialog } from '../command-dialog';
import { RunCalendar, ShiftBriefing } from '../shift-history';
import { FleetStatus } from '../fleet-status';
import { opsSnapshotFresh, OpsPager } from '../presentation';
import * as hooks from '@/hooks/use-operations-command-center';
import type {
  OpsAttentionItem,
  OpsCommandPreview,
  OpsFleetStatus,
} from '@/lib/api/cms/operations';
jest.mock('@/hooks/use-operations-command-center');
const t = (en: string) => en;
const now = Date.parse('2026-10-29T12:00:00Z');
Object.defineProperty(globalThis.crypto, 'randomUUID', {
  configurable: true,
  value: () => '00000000-0000-4000-8000-000000000001',
});
const mutation = { mutate: jest.fn(), isPending: false, isError: false };
const query = (data: unknown, extra = {}) => ({
  data,
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: jest.fn(),
  ...extra,
});
const item: OpsAttentionItem = {
  key: 'case-1',
  fingerprint: 'fp',
  system: 'experience',
  tenant_id: 'tenant-b',
  kind: 'episode',
  severity: 'major',
  title: 'iOS playback degraded',
  detail: 'Confirmed incident',
  count: 3,
  first_seen: new Date(now).toISOString(),
  href: '/platform/real-experience?client=ios',
  snoozed: false,
};
const preview: OpsCommandPreview = {
  scope: {
    command: 'pause_member',
    member_key: 'pipeline',
    lane_key: 'autopilot',
    tenant_id: 'tenant-b',
  },
  snapshot_at: new Date(now).toISOString(),
  expires_at: new Date(now + 90_000).toISOString(),
  target_digest: 'a'.repeat(64),
  target_count: 1,
  excluded: [],
  targets: [
    {
      member_key: 'pipeline',
      lane_key: 'autopilot',
      tenant_id: 'tenant-b',
      state: 'idle',
      exists: true,
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hooks.useOpsClock).mockReturnValue(now);
  jest
    .mocked(hooks.useAckOpsAttention)
    .mockReturnValue(
      mutation as unknown as ReturnType<typeof hooks.useAckOpsAttention>
    );
  jest
    .mocked(hooks.useSnoozeOpsAttention)
    .mockReturnValue(
      mutation as unknown as ReturnType<typeof hooks.useSnoozeOpsAttention>
    );
  jest
    .mocked(hooks.useClearOpsAttention)
    .mockReturnValue(
      mutation as unknown as ReturnType<typeof hooks.useClearOpsAttention>
    );
  jest
    .mocked(hooks.useExecuteOpsCommand)
    .mockReturnValue(
      mutation as unknown as ReturnType<typeof hooks.useExecuteOpsCommand>
    );
  jest
    .mocked(hooks.useMarkOpsBriefingSeen)
    .mockReturnValue(
      mutation as unknown as ReturnType<typeof hooks.useMarkOpsBriefingSeen>
    );
  jest.mocked(hooks.useOpsAttention).mockReturnValue(
    query({
      as_of: new Date(now).toISOString(),
      items: [item],
      adapter_errors: [],
      total: 30,
      offset: 0,
      limit: 10,
      has_more: true,
    }) as unknown as ReturnType<typeof hooks.useOpsAttention>
  );
  jest
    .mocked(hooks.useOpsCommandPreview)
    .mockReturnValue(
      query(preview) as unknown as ReturnType<typeof hooks.useOpsCommandPreview>
    );
});
it('keeps unavailable attention distinct from an empty inbox', () => {
  jest
    .mocked(hooks.useOpsAttention)
    .mockReturnValue(
      query(undefined, { isError: true }) as unknown as ReturnType<
        typeof hooks.useOpsAttention
      >
    );
  render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Attention is unavailable'
  );
  expect(
    screen.queryByText('No matching attention items.')
  ).not.toBeInTheDocument();
});
it('shows cached attention and a warning after a failed refresh', () => {
  jest.mocked(hooks.useOpsAttention).mockReturnValue(
    query(
      {
        as_of: new Date(now).toISOString(),
        items: [item],
        adapter_errors: [],
        total: 1,
      },
      { isError: true }
    ) as unknown as ReturnType<typeof hooks.useOpsAttention>
  );
  render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(screen.getByRole('link', { name: item.title })).toHaveAttribute(
    'href',
    item.href
  );
  expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeDisabled();
});
it('browses beyond the first page and sends server filters', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  rerender(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(hooks.useOpsAttention).toHaveBeenLastCalledWith(
    expect.objectContaining({ offset: 10 })
  );
  await user.selectOptions(screen.getByLabelText('State'), 'snoozed');
  rerender(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(hooks.useOpsAttention).toHaveBeenLastCalledWith(
    expect.objectContaining({
      state: 'snoozed',
      include_snoozed: true,
      offset: 0,
    })
  );
  window.history.replaceState(null, '', '/');
});
it('sends only the displayed evidence when acknowledging or snoozing', async () => {
  render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  const review = {
    key: item.key,
    fingerprint: item.fingerprint,
    severity: item.severity,
    count: item.count,
  };
  await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
  expect(mutation.mutate).toHaveBeenLastCalledWith(review);
  await userEvent.click(screen.getByRole('button', { name: 'Snooze 2h' }));
  expect(mutation.mutate).toHaveBeenLastCalledWith({ review, minutes: 120 });
});
it('keeps stale inbox evidence readable but disables suppression until refreshed', async () => {
  const refetch = jest.fn();
  jest.mocked(hooks.useOpsAttention).mockReturnValue(
    query(
      {
        as_of: new Date(now - 120_000).toISOString(),
        items: [item],
        adapter_errors: [],
        total: 1,
      },
      { refetch }
    ) as unknown as ReturnType<typeof hooks.useOpsAttention>
  );
  render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(screen.getByRole('link', { name: item.title })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Snooze 2h' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('older snapshot');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh inbox' }));
  expect(refetch).toHaveBeenCalled();
});
const fleetRow: OpsFleetStatus = {
  member_key: 'pipeline',
  member_label: 'Pipeline',
  family: 'content',
  kind: 'autopilot',
  lane_key: 'autopilot',
  lane_label: 'Autopilot',
  tenant_id: 'default',
  enabled: true,
  pausable: true,
  state: 'running',
  liveness: 'observable',
  cockpit_path: '/platform/pipeline',
  trust: { state: 'not_applicable', earned: 0, total: 0 },
};
it('links the Pods pipeline to its owner instead of exposing a fleet pause', () => {
  const review = jest.fn();
  render(<FleetStatus fleet={[{ ...fleetRow, member_key: 'pods_pipeline', member_label: 'Pods pipeline', kind: 'pipeline', lane_key: 'processing', lane_label: 'Processing', pausable: false, state: 'paused', cockpit_path: '/platform/media/sources#pods-pipeline', evidence: 'Pipeline paused until resumed; manual processing also waits.' }]} fresh review={review} locale="en" t={t} />);
  expect(screen.getByRole('link', { name: 'Pipeline controls' })).toHaveAttribute('href', '/platform/media/sources#pods-pipeline');
  expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Next due/)).not.toBeInTheDocument();
  expect(review).not.toHaveBeenCalled();
});
it('does not show a cached fleet verdict as current or invent a zero trust score', () => {
  render(
    <FleetStatus
      fleet={[fleetRow]}
      fresh={false}
      review={jest.fn()}
      locale="en"
      t={t}
    />
  );
  expect(screen.getByText('unknown')).toBeInTheDocument();
  expect(screen.getByText('Last observed state: running')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
  expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
});
it('distinguishes an expired pause from an active pause', () => {
  render(
    <FleetStatus
      fleet={[
        { ...fleetRow, paused_until: new Date(now - 60_000).toISOString() },
      ]}
      fresh
      review={jest.fn()}
      locale="en"
      t={t}
    />
  );
  expect(screen.getByText(/Pause expired/)).toBeInTheDocument();
  expect(screen.queryByText(/Pause expires/)).not.toBeInTheDocument();
});
it('keeps tenant rows in a stable order when a poll returns them differently', () => {
  const a = { ...fleetRow, tenant_id: 'tenant-a' },
    z = { ...fleetRow, tenant_id: 'tenant-z' };
  const view = render(
    <FleetStatus fleet={[z, a]} fresh review={jest.fn()} locale="en" t={t} />
  );
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('tenant-a');
  view.rerender(
    <FleetStatus fleet={[a, z]} fresh review={jest.fn()} locale="en" t={t} />
  );
  expect(screen.getAllByRole('article')[0]).toHaveTextContent('tenant-a');
});
it('shows an empty range honestly when a polling inbox shrinks behind the current page', () => {
  render(
    <OpsPager
      offset={20}
      limit={10}
      total={3}
      more={false}
      onChange={jest.fn()}
      t={t}
    />
  );
  expect(screen.getByText('0 / 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
it('shows acknowledgment and lets operators restore a snoozed item', async () => {
  jest.mocked(hooks.useOpsAttention).mockReturnValue(
    query({
      as_of: new Date(now).toISOString(),
      items: [
        {
          ...item,
          state: 'snoozed',
          snoozed: true,
          snoozed_until: new Date(now + 7200_000).toISOString(),
        },
      ],
      adapter_errors: [],
      total: 1,
    }) as unknown as ReturnType<typeof hooks.useOpsAttention>
  );
  render(<AttentionInbox fleet={[]} locale="en" t={t} />);
  expect(screen.getByText('snoozed')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Restore to active' })
  );
  expect(mutation.mutate).toHaveBeenCalledWith(item.key);
});
it('requires explicit scope review, reason and valid TTL before pause', async () => {
  const user = userEvent.setup();
  render(
    <OpsCommandDialog
      scope={preview.scope}
      close={jest.fn()}
      locale="en"
      t={t}
      snapshotFresh
    />
  );
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('tenant-b');
  expect(dialog).toHaveTextContent('This command does not stop services, queues, in-flight work');
  expect(dialog).toHaveTextContent('The Pods pipeline keeps its own Pause/Resume control.');
  const apply = within(dialog).getByRole('button', { name: 'Confirm pause' });
  expect(apply).toBeDisabled();
  expect(mutation.mutate).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Pause reason'), 'Deploy');
  expect(apply).toBeEnabled();
  const duration = screen.getByLabelText('Pause duration in minutes');
  await user.clear(duration);
  await user.type(duration, '0');
  expect(apply).toBeDisabled();
  await user.clear(duration);
  await user.type(duration, '60');
  expect(apply).toBeEnabled();
  await user.click(apply);
  expect(mutation.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      tenant_id: 'tenant-b',
      reason: 'Deploy',
      ttl_minutes: 60,
      target_digest: preview.target_digest,
      snapshot_at: preview.snapshot_at,
      idempotency_key: expect.any(String),
    }),
    expect.any(Object)
  );
  const firstRequest = mutation.mutate.mock.calls[0][0];
  expect(screen.getByLabelText('Pause reason')).toBeDisabled();
  expect(screen.getByLabelText('Pause duration in minutes')).toBeDisabled();
  await user.click(
    screen.getByRole('button', { name: 'Retry original command' })
  );
  expect(mutation.mutate.mock.calls[1][0]).toEqual(firstRequest);
});
it('rejects expired reviews and stale status while preserving readable targets', () => {
  jest.mocked(hooks.useOpsClock).mockReturnValue(now + 120_000);
  render(
    <OpsCommandDialog
      scope={preview.scope}
      close={jest.fn()}
      locale="en"
      t={t}
      snapshotFresh
    />
  );
  expect(screen.getByRole('button', { name: 'Confirm pause' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Evidence is stale');
});
it('does not advance an incomplete briefing', () => {
  jest.mocked(hooks.useOpsBriefing).mockReturnValue(
    query({
      since: 'since',
      through: 'through',
      read_token: '',
      items: [],
      commands: [],
      complete: false,
      adapter_errors: ['pipeline unavailable'],
    }) as unknown as ReturnType<typeof hooks.useOpsBriefing>
  );
  render(<ShiftBriefing locale="en" t={t} />);
  expect(
    screen.getByRole('button', { name: 'Mark briefing read' })
  ).toBeDisabled();
  expect(
    screen.queryByText('No fleet activity in this briefing window.')
  ).not.toBeInTheDocument();
});
it('explains a bounded calendar without an empty adapter error', async () => {
  jest.mocked(hooks.useOpsCalendar).mockReturnValue(
    query({
      as_of: new Date(now).toISOString(),
      window_start: new Date(now - 86400_000).toISOString(),
      fleet: [],
      runs: [],
      events: [],
      overlaps: [],
      complete: false,
      truncated: true,
      adapter_errors: [],
    }) as unknown as ReturnType<typeof hooks.useOpsCalendar>
  );
  render(<RunCalendar locale="en" t={t} />);
  await userEvent.click(screen.getByRole('button', { name: /Run calendar/ }));
  expect(
    screen.getByText(/This window reached its detail limit/)
  ).toBeInTheDocument();
  expect(screen.queryByText('Partial history:')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No recorded runs in this window.')
  ).not.toBeInTheDocument();
});
it('checks freshness without treating invalid or future timestamps as fresh', () => {
  expect(opsSnapshotFresh(new Date(now).toISOString(), now)).toBe(true);
  expect(opsSnapshotFresh(new Date(now - 91_000).toISOString(), now)).toBe(
    false
  );
  expect(opsSnapshotFresh('invalid', now)).toBe(false);
  expect(opsSnapshotFresh(new Date(now + 60_000).toISOString(), now)).toBe(
    false
  );
});
