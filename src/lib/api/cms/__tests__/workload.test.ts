import { cmsClient } from '@/lib/api/client';
import * as api from '../workload';
import {
  decision,
  permit,
  policy,
  registry,
  status,
} from '@/components/platform/workload/__tests__/fixtures';
jest.mock('@/lib/api/client', () => ({
  cmsClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());
it('accepts the current Go status and registry contracts without discarding unknown states', async () => {
  (cmsClient.get as jest.Mock)
    .mockResolvedValueOnce({
      data: {
        ...status,
        resources: [{ ...status.resources[0], state: 'recovering' }],
      },
    })
    .mockResolvedValueOnce({ data: registry });
  expect((await api.getWorkloadStatus()).resources[0].state).toBe('recovering');
  expect((await api.getWorkloadRegistry()).coverage[0].classes).toEqual([
    'text_embedding',
  ]);
});
it.each([
  { ...status, summary: undefined },
  { ...status, resources: [{ ...status.resources[0], available: undefined }] },
  { ...status, heartbeat_at: 'not-a-timestamp' },
  { ...status, policy: { ...policy, mode: 'unknown' } },
])(
  'rejects incomplete live evidence instead of manufacturing an available state',
  async (data) => {
    (cmsClient.get as jest.Mock).mockResolvedValue({ data });
    await expect(api.getWorkloadStatus()).rejects.toThrow(
      'incomplete or incompatible'
    );
  }
);
it('normalizes absent observation collections without inventing observations', async () => {
  (cmsClient.get as jest.Mock).mockResolvedValue({
    data: {
      ...status,
      resources: null,
      attention: null,
      coverage: null,
      reasons: null,
    },
  });
  const result = await api.getWorkloadStatus();
  expect(result.resources).toEqual([]);
  expect(result.coverage).toEqual([]);
});
it('keeps a numeric ledger ID exact and passes the CMS pagination cursor unchanged', async () => {
  (cmsClient.get as jest.Mock).mockResolvedValue({
    data: [{ ...decision, id: 12 }],
    next_cursor: '12',
  });
  const result = await api.listWorkloadDecisions({ before: '30', limit: 50 });
  expect(result.data[0].id).toBe('12');
  expect(result.next_cursor).toBe('12');
  expect(cmsClient.get).toHaveBeenCalledWith(
    '/admin/workload/decisions',
    { before: '30', limit: 50 },
    undefined
  );
});
it('requires an explicit backend revoke capability even for an acquired permit', async () => {
  const { can_revoke, ...withoutCapability } = permit;
  (cmsClient.get as jest.Mock).mockResolvedValue({ data: [withoutCapability] });
  await expect(api.listWorkloadPermits()).rejects.toThrow(
    'incomplete or incompatible'
  );
});
it('submits the reviewed digest and revision exactly through the authenticated CMS proxy', async () => {
  (cmsClient.put as jest.Mock).mockResolvedValue({ data: policy });
  const input = {
    revision: 1,
    mode: 'enforce' as const,
    enforced_classes: ['text_embedding'],
    resource_limits: policy.resource_limits,
    snapshot_max_age_seconds: 90,
    recovery_seconds: 120,
    lease_seconds: 600,
    starvation_minutes: 120,
    review_note: 'Reviewed production observation evidence',
    qualification_digest: 'digest-1',
    confirmation: 'ENFORCE CAPACITY',
  };
  await api.updateWorkloadPolicy(input);
  expect(cmsClient.put).toHaveBeenCalledWith('/admin/workload/policy', input);
});
