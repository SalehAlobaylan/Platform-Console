import { cmsClient } from '@/lib/api/client';
import type { MediaAtomizationPipelineItem, AtomizationFilters, MediaAtomizationPolicy } from '@/types/platform/media-atomization';
import type { StudioChapter } from '@/types/platform/studio';
import type { MediaAtomizationFeedUnit } from '@/types/platform/media-atomization';

type Envelope<T> = { data: T; message?: string };
export type JourneyAction = { code: string; step: string; enabled: boolean; reason_code?: string };
export async function executeJourneyAction(code: string, id: string, generation?: number) {
    const registry: Record<string, { path: string; body: object }> = {
        download: { path: `/admin/media-acquisition/items/${id}/request`, body: {} },
        approve_transcript: { path: '/admin/transcription/jobs', body: { content_id: id, trigger_source: 'manual', force: false } },
        retry_atomization: { path: `/admin/media-atomization/parents/${id}/atomize`, body: {} },
        approve_transcript_for_use: { path: `/admin/content/${id}/transcript/approve`, body: {} },
    };
    const action = registry[code];
    if (!action) throw new Error('Unsupported action; refresh the episode.');
    const url = generation == null ? action.path : `${action.path}?expected_generation=${generation}`;
    return cmsClient.post<Envelope<{ state?: string; triggered?: boolean; reason?: string; job?: { status?: string } }>>(url, action.body);
}
export type JourneyStep = { key: string; state: string; required: boolean; reason_code: string; depends_on?: string[]; waiting_category?: string; started_at?: string; completed_at?: string; last_progress_at?: string; completed?: number; total?: number; actions?: JourneyAction[] };
export type JourneyGeneration = { id: string; state: string; plan_origin?: string; plan: StudioChapter[]; completed_units: number; expected_units: number };
export type MediaJourney = {
    progress_unavailable?: boolean;
    effective_policy?: Partial<MediaAtomizationPolicy>;
    parent: { id: string; title?: string; duration_sec?: number }; item?: MediaAtomizationPipelineItem;
    steps: JourneyStep[]; capacity: { waiting: boolean; episode_id?: string; title?: string };
    active_execution?: { request_id: string; stage: string; state: string; worker: string; lease_expires_at?: string }[];
    published_generation?: JourneyGeneration | null; candidate_generation?: JourneyGeneration | null;
    transcript?: { source?: string; provider?: string; approved_at?: string; verified?: boolean } | null;
    caption_state?: string; caption_outcome?: string; acquisition_mode: string; acquisition_policy_source?: string; auto_stt_enabled: boolean; policy_source?: string; updated_at: string;
};
export type JourneyList = { items: MediaAtomizationPipelineItem[]; counts: { key: string; label: string; count: number }[]; total: number; next_cursor: string; updated_at: string; progress_unavailable?: boolean };
export type JourneyChapter = { id: string; title: string; state: string; unit_index: number; start_ms: number; end_ms: number; child_id?: string; feed_visibility?: string; playback_url?: string; playback_type?: string; failure_class?: string; ready_for_activation?: boolean; review_status?: string; requirements?: { stage: string; state: string; required: boolean; failure_class?: string }[] };
export type JourneyEvent = { sequence: number; stage: string; event_type: string; created_at: string; processing_generation: number };
export type ChapterDraft = { id: string; revision: number; plan: StudioChapter[]; validation: string[]; input_fingerprint: string; applied_request_id?: string; created_at: string; provenance: string };
export type ChapterDrafts = { items: ChapterDraft[]; input_fingerprint: string; worker_supported: boolean; apply_action?: JourneyAction };
export type JourneyPage<T> = { items: T[]; next_cursor: string };
export const journeyKeys = { all: ['media-journey'] as const, detail: (id: string) => ['media-journey', 'detail', id] as const, drafts: (id: string) => ['media-journey', 'drafts', id] as const };
const root = '/admin/media-atomization';
export type PublishedUnit = MediaAtomizationFeedUnit & { chapter_start_ms?: number; chapter_end_ms?: number; publication_at?: string };
export const fetchPublishedJourney = async (filters: AtomizationFilters, path: string, cursor?: string) => (await cmsClient.get<Envelope<JourneyPage<PublishedUnit> & { total: number; parent_count: number; updated_at: string }>>(`${root}/feed-units`, params({ source: filters.source, q: filters.q, path, cursor, view: 'list', limit: 25 }))).data;
const params = (values: Record<string, string | undefined | number>) => Object.fromEntries(Object.entries(values).filter(([,v]) => v !== undefined && v !== 'all')) as Record<string, string | number>;
export const fetchJourneyList = async (filters: AtomizationFilters, lane: string, cursor?: string) => (await cmsClient.get<Envelope<JourneyList>>(`${root}/pipeline`, params({ ...filters, lane, cursor, view: 'list', limit: 25 }))).data;
export const fetchJourney = async (id: string) => (await cmsClient.get<Envelope<MediaJourney>>(`${root}/parents/${id}/journey`)).data;
export const fetchJourneyPage = async <T>(id: string, section: 'chapters' | 'events', cursor?: string) => (await cmsClient.get<Envelope<JourneyPage<T>>>(`${root}/parents/${id}/journey/${section}`, params({ cursor, limit: 25 }))).data;
export const fetchDrafts = async (id: string) => (await cmsClient.get<Envelope<ChapterDrafts>>(`${root}/parents/${id}/chapter-plans`)).data;
export const saveDraft = async (id: string, chapters: StudioChapter[], revision: number) => (await cmsClient.post<Envelope<ChapterDraft>>(`${root}/parents/${id}/chapter-plans`, { expected_revision: revision, chapters })).data;
export const applyDraft = async (id: string, draft: ChapterDraft, key: string) => (await cmsClient.post<Envelope<{ request_id: string; state: string }>>(`${root}/parents/${id}/chapter-plans/${draft.id}/apply`, { revision: draft.revision, input_fingerprint: draft.input_fingerprint, idempotency_key: key })).data;
