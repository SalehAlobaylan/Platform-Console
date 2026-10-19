import { cmsClient } from '@/lib/api/client';
import { getRedundancyStatus, listRedundancyPairs } from '../redundancy';
jest.mock('@/lib/api/client', () => ({ cmsClient: { get: jest.fn() } }));
it('rejects PascalCase payloads rather than silently hiding real records', async () => {
  jest
    .mocked(cmsClient.get)
    .mockResolvedValue({
      policy: { Enabled: true, CollapseEnabled: true },
      open_proposals: 1,
      active_families: 1,
    });
  await expect(getRedundancyStatus()).rejects.toThrow();
});
it('requests server-filtered pending proposals with continuation', async () => {
  jest
    .mocked(cmsClient.get)
    .mockResolvedValue({ data: [], total: 150, offset: 100, limit: 25 });
  await expect(
    listRedundancyPairs({ offset: 100, verdict: 'review' })
  ).resolves.toMatchObject({ total: 150 });
  expect(cmsClient.get).toHaveBeenCalledWith('/admin/media/redundancy/pairs', {
    offset: 100,
    verdict: 'review',
  });
});
