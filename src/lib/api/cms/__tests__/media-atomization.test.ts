import { cmsClient } from '@/lib/api/client';
import { getMediaAtomizationPipeline } from '@/lib/api/cms/media-atomization';

jest.mock('@/lib/api/client', () => ({
    cmsClient: { get: jest.fn() },
}));

describe('media atomization workflow projection', () => {
    it('preserves durable lane authority while normalizing paginated columns', async () => {
        const get = cmsClient.get as jest.Mock;
        get.mockResolvedValueOnce({
            data: {
                columns: [{
                    key: 'failed',
                    label: 'Failed or reconciling',
                    count: 321,
                    displayed_count: 1,
                    next_cursor: 'root-1',
                    items: [{
                        id: 'root-1',
                        lane: 'failed',
                        current_phase: 'reconciling',
                        disposition: 'reconciling',
                        generation_id: 'generation-1',
                        active_attempt_id: 'attempt-1',
                        blocking_reason: 'effect outcome requires reconciliation',
                        retryable: false,
                    }],
                }],
            },
        });

        const result = await getMediaAtomizationPipeline({ lane: 'failed', cursor: 'root-0', limit: 1 });

        expect(get).toHaveBeenCalledWith('/admin/media-atomization/pipeline', {
            lane: 'failed', cursor: 'root-0', limit: 1,
        });
        expect(result.columns).toHaveLength(1);
        expect(result.columns[0]?.count).toBe(321);
        expect(result.columns[0]?.items[0]?.disposition).toBe('reconciling');
        expect(result.columns[0]?.items[0]?.active_attempt_id).toBe('attempt-1');
    });

    it('normalizes a missing item list without changing lane totals', async () => {
        const get = cmsClient.get as jest.Mock;
        get.mockResolvedValueOnce({ data: { columns: [{ key: 'review', count: 4 }] } });

        const result = await getMediaAtomizationPipeline();

        expect(result.columns[0]?.count).toBe(4);
        expect(result.columns[0]?.items).toEqual([]);
    });
});
