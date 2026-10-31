import { cmsClient } from '@/lib/api/client';
import {
  executeOpsCommand,
  getOpsAttention,
  getOpsCommand,
  ackOpsAttention,
  snoozeOpsAttention,
  clearOpsAttention,
  markOpsBriefingSeen,
  previewOpsCommand,
} from '../operations';
jest.mock('@/lib/api/client', () => ({
  cmsClient: { get: jest.fn(), post: jest.fn() },
}));
const get = jest.mocked(cmsClient.get);
const post = jest.mocked(cmsClient.post);
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: {} });
  post.mockResolvedValue({ data: {} });
});
it('sends attention filters and abort signal through the existing BFF client', async () => {
  const controller = new AbortController();
  const filters = {
    system: 'experience',
    state: 'snoozed',
    offset: 25,
    limit: 25,
    include_snoozed: true,
  };
  await getOpsAttention(filters, controller.signal);
  expect(get).toHaveBeenCalledWith(
    '/admin/ops/attention',
    filters,
    controller.signal
  );
});
it('keeps preview read separate from execution and preserves reviewed scope and idempotency', async () => {
  const scope = {
    command: 'pause_member' as const,
    member_key: 'pipeline',
    lane_key: 'autopilot',
    tenant_id: 'tenant-b',
  };
  await previewOpsCommand(scope);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenLastCalledWith('/admin/ops/commands/preview', scope, {
    signal: undefined,
  });
  const request = {
    ...scope,
    snapshot_at: '2026-10-29T12:00:00Z',
    target_digest: 'a'.repeat(64),
    idempotency_key: 'same-intent',
    reason: 'Deploy',
    ttl_minutes: 60,
  };
  await executeOpsCommand(request);
  await executeOpsCommand(request);
  expect(post).toHaveBeenLastCalledWith(
    '/admin/ops/commands/pause-member',
    request
  );
  expect(post.mock.calls[1][1]).toEqual(post.mock.calls[2][1]);
});
it('resumes a specific source and supports per-target inspection', async () => {
  const request = {
    command: 'resume' as const,
    source_command_id: 'source-id',
    snapshot_at: '2026-10-29T12:00:00Z',
    target_digest: 'a'.repeat(64),
    idempotency_key: 'resume-intent',
  };
  await executeOpsCommand(request);
  await getOpsCommand('source/id');
  expect(post).toHaveBeenCalledWith('/admin/ops/commands/resume', request);
  expect(get).toHaveBeenCalledWith(
    '/admin/ops/commands/source%2Fid',
    undefined,
    undefined
  );
});
it('marks exactly the reviewed briefing interval with its server token', async () => {
  await markOpsBriefingSeen('since', 'through', 'signed-token');
  expect(post).toHaveBeenCalledWith('/admin/ops/briefing/seen', {
    since: 'since',
    through: 'through',
    read_token: 'signed-token',
  });
});
it('binds acknowledgment and snooze to the evidence displayed in the inbox', async () => {
  const review = {
    key: 'incident',
    fingerprint: 'observed-evidence',
    severity: 'major',
    count: 3,
  };
  await ackOpsAttention(review);
  expect(post).toHaveBeenLastCalledWith('/admin/ops/attention/ack', review);
  await snoozeOpsAttention(review, 120);
  expect(post).toHaveBeenLastCalledWith('/admin/ops/attention/snooze', {
    ...review,
    ttl_minutes: 120,
  });
});
it('restores attention state without expecting a body from HTTP 204', async () => {
  post.mockResolvedValueOnce(undefined);
  await expect(clearOpsAttention('incident')).resolves.toBeUndefined();
  expect(post).toHaveBeenLastCalledWith('/admin/ops/attention/clear', {
    key: 'incident',
  });
});
