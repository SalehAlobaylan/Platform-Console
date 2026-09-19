import { cmsClient } from '@/lib/api/client';
import { executeJourneyAction, saveDraft, applyDraft, type ChapterDraft } from './media-journey';

jest.mock('@/lib/api/client', () => ({ cmsClient: { post: jest.fn(), get: jest.fn() } }));
const post = cmsClient.post as jest.Mock;
describe('CMS-owned journey actions', () => {
    beforeEach(() => { post.mockReset(); post.mockResolvedValue({ data: { state: 'awaiting_approval' } }); });
    it('does not force STT replacement or claim processing started', async () => {
        const result = await executeJourneyAction('approve_transcript', 'episode');
        expect(post).toHaveBeenCalledWith('/admin/transcription/jobs', { content_id: 'episode', trigger_source: 'manual', force: false });
        expect(result.data.state).toBe('awaiting_approval');
    });
    it('rejects unknown actions without posting', async () => {
        await expect(executeJourneyAction('arbitrary_endpoint','episode')).rejects.toThrow('Unsupported');
        expect(post).not.toHaveBeenCalled();
    });
    it('includes the generation shown to the operator for transactional stale-action rejection', async () => {
        await executeJourneyAction('download', 'episode', 7);
        expect(post).toHaveBeenCalledWith('/admin/media-acquisition/items/episode/request?expected_generation=7', {});
    });
    it('separates draft saves from exact-revision application', async () => {
        await saveDraft('episode', [], 3);
        expect(post).toHaveBeenLastCalledWith('/admin/media-atomization/parents/episode/chapter-plans', { expected_revision: 3, chapters: [] });
        const draft = { id: 'draft', revision: 4, input_fingerprint: 'proof' } as ChapterDraft;
        await applyDraft('episode', draft, 'operation');
        expect(post).toHaveBeenLastCalledWith('/admin/media-atomization/parents/episode/chapter-plans/draft/apply', { revision: 4, input_fingerprint: 'proof', idempotency_key: 'operation' });
    });
});
