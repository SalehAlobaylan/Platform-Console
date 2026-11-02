import { cmsClient } from '@/lib/api/client';
import { createCampaign, startCampaign } from '../embedding-lifecycle';

jest.mock('@/lib/api/client', () => ({ cmsClient: { post: jest.fn() } }));

it('sends reviewed execution limits and the exact confirmed target to CMS', async () => {
  const caps = {
    items_per_batch: 20,
    batches_per_run: 1,
    daily_item_cap: 100,
    retry_ceiling: 2,
  };
  await createCampaign('text', caps);
  expect(cmsClient.post).toHaveBeenCalledWith(
    '/admin/embedding-lifecycle/campaigns',
    { space: 'text', ...caps }
  );
  await startCampaign(7, 'Approved upgrade', 'a'.repeat(64));
  expect(cmsClient.post).toHaveBeenCalledWith(
    '/admin/embedding-lifecycle/campaigns/7/start',
    { reason: 'Approved upgrade', target_space_id: 'a'.repeat(64) }
  );
});
