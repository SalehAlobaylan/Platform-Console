import { cmsClient } from '@/lib/api/client';
import { createPodsResetQuantityPreview, createPodsResetPreview, executePodsResetRun } from './pods-reset';

jest.mock('@/lib/api/client', () => ({ cmsClient: { get: jest.fn(), post: jest.fn() } }));
afterEach(() => { jest.useRealTimers(); jest.resetAllMocks(); });

const idFor = (index: number) => '00000000-0000-4000-8000-' + String(index).padStart(12, '0');
const execution = { id: 'saved-run', manifestHash: 'approved-hash', confirmedItemCount: 163 };
const progressItem = (state: string, due?: string, error?: string) => ({
  content_item_id: idFor(1), state, snapshot_hash: 'snapshot', decision: [], blocked_reasons: [],
  verification_not_before: due, last_error: error,
});

it('continues preparation, deletion and verification from one confirmation with the same full manifest/count', async () => {
  const steps = [
    { state: 'partial', phase: 'fencing', items: [progressItem('planned')] },
    { state: 'partial', phase: 'batch_complete', items: [progressItem('fenced')] },
    { state: 'partial', phase: 'verification_wait', items: [progressItem('verification_pending', new Date(Date.now() - 1).toISOString())] },
    { state: 'complete', phase: 'purge_only_complete', items: [progressItem('complete')] },
  ];
  for (const step of steps) jest.mocked(cmsClient.post).mockResolvedValueOnce({ data: { id: 'saved-run', resume_allowed: true, ...step } });
  const onProgress = jest.fn();
  expect((await executePodsResetRun(execution, onProgress)).state).toBe('complete');
  expect(onProgress.mock.calls.map(([progress]) => progress.phase)).toEqual(steps.map((step) => step.phase));
  expect(cmsClient.post).toHaveBeenCalledTimes(4);
  for (const call of jest.mocked(cmsClient.post).mock.calls) expect(call).toEqual([
    '/admin/pods-reset/plans/saved-run/execute', { manifest_hash: 'approved-hash', confirmed_item_count: 163 },
  ]);
});

it('waits for the next file-absence probe without repeated execution requests', async () => {
  jest.useFakeTimers();
  jest.mocked(cmsClient.post)
    .mockResolvedValueOnce({ data: { id: 'saved-run', state: 'partial', phase: 'verification_wait', resume_allowed: true, items: [progressItem('verification_pending', new Date(Date.now() + 60_000).toISOString(), 'verification_probe_not_due')] } })
    .mockResolvedValueOnce({ data: { id: 'saved-run', state: 'complete' } });
  const result = executePodsResetRun(execution);
  await jest.advanceTimersByTimeAsync(59_999);
  expect(cmsClient.post).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect((await result).state).toBe('complete');
  expect(cmsClient.post).toHaveBeenCalledTimes(2);
});

it.each([
  { phase: 'paused' },
  { phase: 'partial', warning: 'Storage deletion failed' },
  { phase: 'fencing', items: [progressItem('planned', undefined, 'Selected content changed')] },
])('stops continuation on a pause or failure: %s', async (stop) => {
  const data = { id: 'saved-run', state: 'partial', resume_allowed: true, items: [progressItem('planned')], ...stop };
  jest.mocked(cmsClient.post).mockResolvedValue({ data });
  await executePodsResetRun(execution);
  expect(cmsClient.post).toHaveBeenCalledTimes(1);
});

it('stops between requests when the recovery page closes', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { id: 'saved-run', state: 'partial', phase: 'verification_wait', resume_allowed: true, items: [progressItem('verification_pending', new Date(Date.now() + 60_000).toISOString())] } });
  const result = executePodsResetRun(execution, undefined, controller.signal);
  await jest.advanceTimersByTimeAsync(1);
  controller.abort();
  expect((await result).state).toBe('partial');
  expect(cmsClient.post).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('creates a separate protection preview using the previously reviewed IDs without selecting replacements', async () => {
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { run: { id: 'new-preview' } } });
  await createPodsResetPreview([idFor(1), idFor(2)], 'Old content', { codes: ['approved_transcript'], reason: 'Reviewed obsolete captions' });
  expect(cmsClient.get).not.toHaveBeenCalled();
  expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans', {
    content_ids: [idFor(1), idFor(2)], selection_reason: 'Old content',
    protection_override_codes: ['approved_transcript'], protection_override_reason: 'Reviewed obsolete captions',
  });
});

it.each([31, 435])('selects exactly %s items through bounded inventory pages', async (count) => {
  jest.mocked(cmsClient.get).mockImplementation(async (url) => {
    const params = new URL(url, 'http://cms.test').searchParams;
    const offset = params.has('cursor') ? Number(params.get('cursor')!.slice(-12)) : 0;
    const limit = Number(params.get('limit'));
    expect(limit).toBeLessThanOrEqual(100);
    expect(params.get('type')).toBe('PODCAST');
    expect(params.get('status')).toBe('FAILED');
    expect(params.get('source_id')).toBe(idFor(999));
    const items = Array.from({ length: Math.min(limit, count - offset) }, (_, index) => ({
      content_item_id: idFor(offset + index + 1), title: 'Episode ' + (offset + index + 1),
    }));
    return { data: { items, total_count: count, has_more: offset + items.length < count, next_cursor: items.at(-1)?.content_item_id } };
  });
  jest.mocked(cmsClient.post).mockResolvedValue({ data: { run: { id: 'frozen' }, counts: { selected_ids: count } } });
  const result = await createPodsResetQuantityPreview(count, { type: 'PODCAST', status: 'FAILED', source_id: idFor(999), cursor: 'ignored', limit: 30 }, 'Failed imports');
  expect(cmsClient.get).toHaveBeenCalledTimes(Math.ceil(count / 100));
  expect(cmsClient.post).toHaveBeenCalledTimes(1);
  expect(cmsClient.post).toHaveBeenCalledWith('/admin/pods-reset/plans', {
    content_ids: Array.from({ length: count }, (_, index) => idFor(index + 1)), selection_reason: 'Failed imports',
  });
  expect(result.selectionTitles[idFor(count)]).toBe('Episode ' + count);
  expect(result.counts.selected_ids).toBe(count);
});

it.each(['shrinking_scope', 'short_page', 'duplicate_item', 'repeated_cursor'])('does not send a reduced or ambiguous selection after %s', async (failure) => {
  let page = 0;
  jest.mocked(cmsClient.get).mockImplementation(async () => {
    page++;
    if (page === 1) return { data: { items: [{ content_item_id: idFor(1) }], total_count: 150, has_more: true, next_cursor: idFor(1) } };
    const second = { items: [{ content_item_id: idFor(2) }], total_count: 150, has_more: true, next_cursor: idFor(2) };
    if (failure === 'shrinking_scope') second.total_count = 149;
    if (failure === 'short_page') second.has_more = false;
    if (failure === 'duplicate_item') second.items[0].content_item_id = idFor(1);
    if (failure === 'repeated_cursor') second.next_cursor = idFor(1);
    return { data: second };
  });
  await expect(createPodsResetQuantityPreview(150, { type: 'ALL' }, 'Failed imports')).rejects.toThrow();
  expect(cmsClient.get).toHaveBeenCalledTimes(2);
  expect(cmsClient.post).not.toHaveBeenCalled();
});

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %s before fetching inventory', async (count) => {
  await expect(createPodsResetQuantityPreview(count, {}, 'Failed imports')).rejects.toThrow('positive whole number');
  expect(cmsClient.get).not.toHaveBeenCalled();
  expect(cmsClient.post).not.toHaveBeenCalled();
});
