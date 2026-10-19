import { z } from 'zod';
import { cmsClient } from '@/lib/api/client';

const BASE = '/admin/media/redundancy';
const pairSchema = z.object({
  id: z.string().uuid(),
  item_a_id: z.string().uuid(),
  item_b_id: z.string().uuid(),
  confidence: z.number(),
  verdict: z.string(),
  tombstoned: z.boolean(),
  latest_evaluation_id: z.number().nullable(),
  reject_reason: z.string().optional(),
  created_at: z.string(),
});
const familySchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  canonical_content_item_id: z.string().uuid(),
  canonical_locked_by: z.string(),
  canonical_reasons: z.array(z.string()).nullable(),
  last_confirmed_at: z.string(),
});
export type RedundancyPair = z.infer<typeof pairSchema>;
export type RedundancyFamily = z.infer<typeof familySchema>;
export type LaneSettings = {
  transcript_confirm: number;
  embedding_confirm: number;
  title_confirm: number;
  title_weight: number;
  transcript_weight: number;
  embedding_weight: number;
  thumbnail_weight: number;
};
export type RedundancyPolicy = {
  enabled: boolean;
  collapse_enabled: boolean;
  emit_circulation_recs: boolean;
  sweep_interval_minutes: number;
  max_frontier_items: number;
  max_pairs_scored: number;
  proposal_floor: number;
  lane_settings: Partial<LaneSettings>;
  paused_until: string | null;
  last_swept_at: string | null;
  scan_state: {
    scope?: string;
    cursor_at?: string;
    pending_id?: string;
    candidates?: string[];
  };
  updated_at: string;
};
export type RedundancyRun = {
  id: string;
  trigger: string;
  status: string;
  summary: string;
  started_at: string;
  finished_at: string | null;
  counts: Record<string, number>;
  error: string;
};
export type RedundancyAction = {
  id: string;
  action_kind: string;
  actor: string;
  outcome: string;
  reason: string;
  created_at: string;
  metadata: unknown;
};
export type RedundancyStatus = {
  policy: RedundancyPolicy;
  latest_run: RedundancyRun | null;
  library_items: number;
  open_proposals: number;
  active_families: number;
  redundant_members: number;
  redundant_bytes: number;
  redundancy_rate: number;
  fingerprint_items: number;
  oldest_proposal_at: string | null;
  reclaim_awaiting_approval: number;
  lane_settings: LaneSettings;
  evaluator_version: string;
  attention?: Array<{
    id: string;
    canonical_id: string;
    canonical_unavailable: boolean;
    engagement_conflict: boolean;
  }>;
  generated_at: string;
};
export type MediaEvidence = {
  id: string;
  title?: string;
  source_name?: string;
  type: string;
  duration_sec?: number;
  thumbnail_url?: string;
  playback_url?: string;
  playback_type?: 'hls' | 'mp4' | 'audio';
  fallback_playback_url?: string;
  media_renditions?: Array<{
    url?: string;
    playback_url?: string;
    format?: string;
  }>;
  media_url?: string;
  original_url?: string;
  file_size_bytes: number;
  view_count: number;
  like_count: number;
  share_count: number;
};
export type PairEvaluation = {
  id: number;
  pair_id: number;
  confidence: number;
  machine_verdict: string;
  evaluator_version: string;
  input_fingerprint: string;
  created_at: string;
  lane_scores: Record<
    string,
    { score: number; available: boolean; reason?: string }
  >;
};
export type PairDetail = {
  pair: RedundancyPair;
  items: MediaEvidence[];
  evaluations: PairEvaluation[];
  transcript_snippets: Record<string, string>;
  matching_shingle: string;
};
export type FamilyDetail = {
  family: RedundancyFamily;
  members: Array<{ content_item_id: string; role: string }>;
  items: MediaEvidence[];
  collapse_active: boolean;
  recommendations: Array<{
    id: string;
    verdict: string;
    status: string;
    subject_id: string;
  }>;
};
export type Page<T> = {
  data: T[];
  total: number;
  offset: number;
  limit: number;
};
export async function getRedundancyStatus() {
  const data = await cmsClient.get<RedundancyStatus>(`${BASE}/status`);
  z.object({
    policy: z.object({
      enabled: z.boolean(),
      collapse_enabled: z.boolean(),
      emit_circulation_recs: z.boolean(),
    }),
    open_proposals: z.number(),
    active_families: z.number(),
    generated_at: z.string(),
  }).parse(data);
  return data;
}
export async function listRedundancyPairs(
  params: {
    verdict?: string;
    offset?: number;
    run?: string;
    item?: string;
    min_confidence?: number;
  } = {}
) {
  const raw = await cmsClient.get<unknown>(`${BASE}/pairs`, params);
  return z
    .object({
      data: z
        .array(pairSchema)
        .nullable()
        .transform((v) => v ?? []),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    })
    .parse(raw);
}
export const getRedundancyPair = async (id: string) =>
  (await cmsClient.get<{ data: PairDetail }>(`${BASE}/pairs/${id}`)).data;
export const runRedundancy = (scope: 'frontier' | 'full') =>
  cmsClient.post<{ data: RedundancyRun }>(`${BASE}/run`, { scope });
export const confirmRedundancyPair = (data: {
  id: string;
  evaluationId: number;
}) =>
  cmsClient.post<{ success: boolean; warning?: string }>(
    `${BASE}/pairs/${data.id}/confirm`,
    { evaluation_id: data.evaluationId }
  );
export const rejectRedundancyPair = (data: { id: string; reason: string }) =>
  cmsClient.post(`${BASE}/pairs/${data.id}/reject`, { reason: data.reason });
export async function listRedundancyFamilies(offset = 0) {
  const raw = await cmsClient.get<unknown>(`${BASE}/families`, { offset });
  return z
    .object({
      data: z
        .array(familySchema)
        .nullable()
        .transform((v) => v ?? []),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    })
    .parse(raw);
}
export const getRedundancyFamily = async (id: string) =>
  (await cmsClient.get<{ data: FamilyDetail }>(`${BASE}/families/${id}`)).data;
export const setRedundancyCanonical = (data: {
  id: string;
  contentItemId: string;
  locked: boolean;
}) =>
  cmsClient.post(`${BASE}/families/${data.id}/canonical`, {
    content_item_id: data.contentItemId,
    locked: data.locked,
  });
export const dissolveRedundancyFamily = (data: {
  id: string;
  reason: string;
}) =>
  cmsClient.post(`${BASE}/families/${data.id}/dissolve`, {
    reason: data.reason,
  });
export const listRedundancyRuns = (offset = 0) =>
  cmsClient.get<{ data: RedundancyRun[] }>(`${BASE}/runs`, { offset });
export const getRedundancyRun = async (id: string, offset = 0) =>
  (
    await cmsClient.get<{
      data: {
        run: RedundancyRun;
        evaluations: PairEvaluation[];
        total: number;
        offset: number;
        limit: number;
      };
    }>(`${BASE}/runs/${id}`, { offset })
  ).data;
export const listRedundancyActions = (
  params: {
    offset?: number;
    family?: string;
    pair?: string;
    run?: string;
    outcome?: string;
  } = {}
) => cmsClient.get<Page<RedundancyAction>>(`${BASE}/actions`, params);
export const updateRedundancyPolicy = (
  data: Partial<RedundancyPolicy> & { expected_updated_at?: string }
) => cmsClient.put<RedundancyPolicy>(`${BASE}/policy`, data);
export const pauseRedundancy = (minutes: number) =>
  cmsClient.post(`${BASE}/pause`, { minutes });
