import { cmsClient } from '@/lib/api/client';
import { isInternalOperatorDeepLink } from '@/lib/operator/schemas';
import { z } from 'zod';
import type {
    AutopilotRunDetail,
    GenerateRecommendationsResponse,
    IntelligenceDiagnostics,
    MediaAutopilotElevatedMode,
    MediaCirculationCockpit,
    MediaCirculationHealth,
    MediaCirculationOverride,
    MediaCirculationOverrideRequest,
    MediaCirculationPolicy,
    MediaCirculationRecommendation,
    MediaCirculationRun,
    MediaSourceDiversity,
    MediaSourceRunTrace,
    MediaSupplyEpisodeListResponse,
    MediaSupplyStatusResponse,
    MediaSupplyActionEventPage,
    MediaSupplyActionPreview,
    MediaSupplyActionRequest,
    MediaSupplyActionHistoryPage,
	MediaSupplyQualificationState,
    OverrideListResponse,
    RecommendationListResponse,
    RecommendationUnitType,
} from '@/types/platform/media-circulation';

const timestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Expected an RFC3339 timestamp');
const uuidSchema = z.string().uuid();
const nullableTimestampSchema = timestampSchema.nullable().optional();

const supplyCountsSchema = z.object({
    due_unadmitted: z.number().int().nonnegative(),
    in_flight: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    schedule_unknown: z.number().int().nonnegative(),
    delivery_verified: z.number().int().nonnegative(),
    delivery_pending: z.number().int().nonnegative(),
    delivery_degraded: z.number().int().nonnegative(),
    delivery_unknown: z.number().int().nonnegative(),
	no_upstream_change: z.number().int().nonnegative(),
	upstream_deferred: z.number().int().nonnegative(),
	intake_blocked: z.number().int().nonnegative(),
});

const supplyEvaluationSchema = z.object({
    schema_version: z.literal('media-supply/v1'),
    evaluated_at: timestampSchema,
    verdict: z.string().min(1),
    headline_boundary: z.string().min(1),
    owner: z.string().min(1),
    evidence_completeness: z.enum(['complete', 'partial', 'unavailable']),
    read_only: z.literal(true),
    summary: z.string().min(1),
    counts: supplyCountsSchema,
    affected_source_ids: z.array(uuidSchema).max(50),
    affected_request_ids: z.array(uuidSchema).max(50),
    unknowns: z.array(z.string().min(1)).max(20),
});

const scheduleItemSchema = z.object({
    source_id: uuidSchema,
    source_name: z.string(),
    schedule_state: z.string().min(1),
    reason: z.string().min(1),
    next_due_at: nullableTimestampSchema,
    last_claimed_at: nullableTimestampSchema,
    last_attempted_at: nullableTimestampSchema,
    last_provider_success_at: nullableTimestampSchema,
	last_upstream_observed_at: nullableTimestampSchema,
	last_no_change_at: nullableTimestampSchema,
    last_new_item_at: nullableTimestampSchema,
    last_delivery_verified_at: nullableTimestampSchema,
    intake_circuit_until: nullableTimestampSchema,
    latest_request_id: uuidSchema.nullable().optional(),
    latest_request_state: z.string().optional(),
});

const schedulesSchema = z.object({
    generated_at: timestampSchema,
    available: z.boolean(),
    unavailable_reason: z.string().optional(),
    due_unadmitted: z.number().int().nonnegative(),
    in_flight: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
    items: z.array(scheduleItemSchema).max(24),
});

const deliveryItemSchema = z.object({
    request_id: uuidSchema,
    source_id: uuidSchema,
    source_name: z.string(),
    request_state: z.string().min(1),
    evidence_state: z.string(),
    delivery_state: z.string().min(1),
    reason: z.string().min(1),
    ingest_verdict: z.string().optional(),
    pods_verdict: z.string().optional(),
	terminal_outcome: z.string().optional(),
    observation_attempts: z.number().int().nonnegative(),
    requested_at: timestampSchema,
    ingest_observed_at: nullableTimestampSchema,
    pods_observed_at: nullableTimestampSchema,
    next_observation_at: nullableTimestampSchema,
});

const deliverySchema = z.object({
    generated_at: timestampSchema,
    verified: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
    not_observed: z.number().int().nonnegative(),
    last_verified_at: nullableTimestampSchema,
    items: z.array(deliveryItemSchema).max(24),
});

const supplyEvaluatorSchema = z.object({
    recording_enabled: z.boolean().nullable(),
    worker_state: z.enum(['ready', 'stale', 'not_started']),
    worker_last_heartbeat_at: nullableTimestampSchema,
    worker_stale_after_at: nullableTimestampSchema,
    last_outcome: z.enum(['evaluated', 'disabled', 'control_unavailable', 'record_failed']).optional(),
    last_trigger: z.enum(['scheduled', 'manual']).optional(),
    last_observed_at: nullableTimestampSchema,
    last_evaluated_at: nullableTimestampSchema,
    evaluation_digest: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
    unknowns: z.array(z.string().min(1)).max(10),
});

const supplyOperationalSchema = z.object({
    state: z.enum(['ready', 'attention', 'degraded']),
    workers: z.record(z.enum(['ready', 'stale'])),
	owners: z.record(z.object({
		state: z.enum(['ready', 'stale', 'not_started']),
		observed_at: nullableTimestampSchema,
		stale_after_at: nullableTimestampSchema,
		detail: z.string().min(1).optional(),
	})),
    backlogs: z.record(z.number().int().nonnegative()),
	metrics: z.object({
		schema_version: z.literal('media-supply-operational-metrics/v1'),
		generated_at: timestampSchema,
		 samples: z.array(z.object({
			name: z.string().min(1).max(80),
			owner: z.enum(['cms', 'aggregation', 'media_enrichment']),
			action: z.enum(['source_run', 'supply_action', 'pipeline_repair', 'artifact_coverage', 'atomization', 'consumer_boundary', 'supply_episode']),
			stage: z.enum(['admission', 'dispatch', 'receipt', 'provider', 'pipeline', 'execution', 'control', 'verification', 'return', 'render', 'view', 'evaluation']),
			verdict: z.enum(['open', 'expired', 'retained', 'pending', 'cancelled', 'blocked', 'failed', 'present']),
			value: z.number().nonnegative(),
			unit: z.enum(['count', 'seconds']),
		})).max(32),
		truncated: z.boolean(),
		unknowns: z.array(z.string().min(1)).max(16),
	}),
    unknowns: z.array(z.string().min(1)).max(10),
    generated_at: timestampSchema,
});

const podsExposureSchema = z.object({
    schema_version: z.literal('pods-exposure/v2'),
    generated_at: timestampSchema,
    verdict: z.enum(['unknown', 'no_base_eligible_inventory', 'eligible_not_generation_reachable', 'eligible_not_returned', 'pods_inventory_stale', 'return_path_observed']),
    evidence_completeness: z.enum(['complete', 'partial', 'unavailable']),
    base_eligible_count: z.number().int().nonnegative(),
    reachable_count: z.number().int().nonnegative(),
    returned_count: z.number().int().nonnegative(),
    distinct_returned_count: z.number().int().nonnegative(),
	eligible_returned_gap: z.number().int().nonnegative(),
	repeat_pressure: z.number().min(0).max(1),
	active_generation_id: uuidSchema.nullable().optional(),
	probe_id: uuidSchema,
    newest_eligible_at: nullableTimestampSchema,
    newest_reachable_at: nullableTimestampSchema,
	newest_returned_at: nullableTimestampSchema,
    last_feed_rendered_at: nullableTimestampSchema,
    last_exact_view_at: nullableTimestampSchema,
    returned_ids: z.array(uuidSchema).max(48),
	rendered_ids: z.array(uuidSchema).max(48),
	viewed_ids: z.array(uuidSchema).max(48),
    unknowns: z.array(z.string().min(1)).max(10),
});

const mediaSupplyStatusSchema = z.object({
    supply_evaluation: supplyEvaluationSchema,
    schedules: schedulesSchema,
    delivery: deliverySchema,
    evaluator: supplyEvaluatorSchema,
    operational: supplyOperationalSchema,
    exposure: podsExposureSchema,
});

const mediaSupplyEpisodeSchema = z.object({
    id: uuidSchema,
    tenant_id: z.string().min(1).max(64),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    first_failed_boundary: z.string().min(1),
    verdict: z.string().min(1),
    severity: z.enum(['info', 'warning', 'major', 'critical']),
    owner: z.string().min(1),
    state: z.enum(['open', 'recovering', 'resolved']),
    summary: z.string().min(1),
    affected_subjects: z
        .array(
            z.object({
                type: z.enum(['content_source', 'source_run_request', 'content_item']),
                id: uuidSchema,
            })
        )
        .max(100),
    evidence_digest: z.string().regex(/^[a-f0-9]{64}$/),
    evidence_completeness: z.enum(['complete', 'partial', 'unavailable']),
    evidence: z.object({}).passthrough(),
    first_seen_at: timestampSchema,
    last_seen_at: timestampSchema,
    slo_deadline_at: nullableTimestampSchema,
    resolved_at: nullableTimestampSchema,
    resolution_proof: z.object({}).passthrough().optional(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
});

const mediaSupplyEpisodeListSchema = z.object({
    schema_version: z.literal('media-supply/v1'),
    items: z.array(mediaSupplyEpisodeSchema).max(50),
    next_cursor: z.string(),
});

const mediaSupplyEligibleActionsSchema = z.object({
    schema_version: z.literal('media-supply-actions/v1'),
    episode_id: uuidSchema,
    items: z.array(z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), key: z.string().min(1), target_type: z.string().min(1), risk: z.string().min(1), execution_owner: z.string().min(1), affected_domains: z.array(z.string().min(1)).max(10), manual_only: z.boolean(), disabled: z.boolean(), disabled_control: z.string().min(1).optional() })).max(32),
});
const internalSupplyDeepLinkSchema = z.string().refine(isInternalOperatorDeepLink, 'Internal Console deep link required.');
const verifiedSupplyEffectsSchema = z.object({
	schema_version: z.literal('media-supply-verified-effects/v1'),
	proof: z.unknown(),
	affected_domains: z.array(z.string().min(1).max(64)).max(10),
	affected_subjects: z.array(z.object({ type: z.string().min(1).max(64), id: z.string().min(1).max(160) })).max(64),
	deep_links: z.array(internalSupplyDeepLinkSchema).max(16),
});
const mediaSupplyActionPreviewSchema = z.object({ id: uuidSchema, action_key: z.string().min(1), target_type: z.string().min(1), target_id: uuidSchema, evidence_digest: z.string().regex(/^[a-f0-9]{64}$/), policy_digest: z.string().regex(/^[a-f0-9]{64}$/), state: z.enum(['active','consumed','invalidated']), expires_at: timestampSchema, planned_effects: z.object({}).passthrough(), affected_subjects: z.array(z.unknown()), deep_links: z.array(internalSupplyDeepLinkSchema) });
const mediaSupplyActionRequestSchema = z.object({ id: uuidSchema, action_key: z.string().min(1), target_type: z.string().min(1), target_id: uuidSchema, execution_owner: z.string().min(1), state: z.string().min(1), planned_effects: z.object({}).passthrough(), before_effects: z.object({}).passthrough().optional(), after_effects: z.object({}).passthrough().optional(), verified_effects: verifiedSupplyEffectsSchema.optional(), affected_subjects: z.array(z.unknown()), affected_domains: z.array(z.string().min(1)).max(10), deep_links: z.array(internalSupplyDeepLinkSchema), created_at: timestampSchema, updated_at: timestampSchema, finished_at: nullableTimestampSchema });
const mediaSupplyActionHistorySchema = z.object({ schema_version: z.literal('media-supply-action-history/v1'), episode_id: uuidSchema, items: z.array(mediaSupplyActionRequestSchema).max(50), next_cursor: z.string().max(1024) });
const mediaSupplyActionEventsSchema = z.object({ id: uuidSchema, state: z.string().min(1), events: z.array(z.object({ id: uuidSchema, sequence: z.number().int().positive(), event_type: z.string().min(1), payload: z.object({}).passthrough(), occurred_at: timestampSchema })).max(100), next_sequence: z.number().int().nonnegative() });
const mediaSupplyQualificationStateSchema = z.object({
	schema_version: z.literal('media-supply-qualification/v1'),
	safe_auto_default: z.literal('disabled'),
	reports: z.array(z.object({ id: uuidSchema, tenant_id: z.string().min(1), action_key: z.string().min(1), action_version: z.string().min(1), adapter_version: z.string().min(1), verifier_version: z.string().min(1), schema_version: z.string().min(1), policy_version: z.string().min(1), environment_identity: z.string().min(1), build_identity: z.string().min(1), state: z.string().min(1), report_digest: z.string().regex(/^[a-f0-9]{64}$/), seal: z.string().optional(), created_at: timestampSchema, sealed_at: nullableTimestampSchema })).max(100),
	promotions: z.array(z.object({ id: uuidSchema, tenant_id: z.string().min(1), action_key: z.string().min(1), action_version: z.string().min(1), environment_identity: z.string().min(1), build_identity: z.string().min(1), state: z.string().min(1), promotion_epoch: z.number().int().nonnegative(), report_digest: z.string().regex(/^[a-f0-9]{64}$/), promoted_at: timestampSchema, demoted_at: nullableTimestampSchema, demotion_reason: z.string().optional() })).max(100),
});

function parseSupplyPayload<T>(schema: z.ZodType<T>, payload: unknown, label: string): T {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(`CMS returned an invalid ${label} payload`);
    }
    return parsed.data;
}

/** GET /admin/media/circulation/health */
export async function getMediaCirculationHealth(): Promise<MediaCirculationHealth> {
    return cmsClient.get<MediaCirculationHealth>('/admin/media/circulation/health');
}

/** GET /admin/media/circulation/source-diversity — diagnostic only. */
export async function getMediaSourceDiversity(): Promise<MediaSourceDiversity> {
    return cmsClient.get<MediaSourceDiversity>('/admin/media/circulation/source-diversity');
}

/** GET /admin/media/circulation/cockpit */
export async function getMediaCirculationCockpit(): Promise<MediaCirculationCockpit> {
    return cmsClient.get<MediaCirculationCockpit>('/admin/media/circulation/cockpit');
}

/** GET /admin/media/circulation/supply — bounded, CMS-owned evidence only. */
export async function getMediaSupplyStatus(): Promise<MediaSupplyStatusResponse> {
    const payload = await cmsClient.get<unknown>('/admin/media/circulation/supply');
    return parseSupplyPayload(mediaSupplyStatusSchema, payload, 'Media Supply status');
}

/** GET /admin/media/circulation/supply/episodes — immutable episode cursor page. */
export async function listMediaSupplyEpisodes(limit = 8, cursor = '', signal?: AbortSignal): Promise<MediaSupplyEpisodeListResponse> {
    const payload = await cmsClient.get<unknown>('/admin/media/circulation/supply/episodes', { limit, ...(cursor ? { cursor } : {}) }, signal);
    return parseSupplyPayload(mediaSupplyEpisodeListSchema, payload, 'Media Supply episode list');
}

export async function listMediaSupplyEligibleActions(episodeID: string) {
    return parseSupplyPayload(mediaSupplyEligibleActionsSchema, await cmsClient.get<unknown>(`/admin/media/circulation/supply/episodes/${encodeURIComponent(episodeID)}/actions`), 'Media Supply eligible actions');
}
export async function createMediaSupplyActionPreview(key: string, episodeID: string, eligibilityID: string): Promise<MediaSupplyActionPreview> {
    return parseSupplyPayload(mediaSupplyActionPreviewSchema, await cmsClient.post<unknown>(`/admin/media/circulation/supply/action-keys/${encodeURIComponent(key)}/preview`, { episode_id: episodeID, eligibility_id: eligibilityID }), 'Media Supply action preview');
}
export async function confirmMediaSupplyActionPreview(previewID: string): Promise<MediaSupplyActionRequest> {
    return parseSupplyPayload(mediaSupplyActionRequestSchema, await cmsClient.post<unknown>(`/admin/media/circulation/supply/action-previews/${encodeURIComponent(previewID)}/confirm`, { confirmation: 'CONFIRM' }), 'Media Supply action confirmation');
}
export async function listMediaSupplyActionHistory(episodeID: string, cursor = '', signal?: AbortSignal): Promise<MediaSupplyActionHistoryPage> {
 return parseSupplyPayload(mediaSupplyActionHistorySchema, await cmsClient.get<unknown>(`/admin/media/circulation/supply/episodes/${encodeURIComponent(episodeID)}/action-history`, { limit: 10, ...(cursor ? { cursor } : {}) }, signal), 'Media Supply action history');
}
export async function getMediaSupplyAction(actionID: string, signal?: AbortSignal): Promise<MediaSupplyActionRequest> { return parseSupplyPayload(mediaSupplyActionRequestSchema, await cmsClient.get<unknown>(`/admin/media/circulation/supply/actions/${encodeURIComponent(actionID)}`, undefined, signal), 'Media Supply action'); }
export async function cancelMediaSupplyAction(actionID: string): Promise<MediaSupplyActionRequest> { return parseSupplyPayload(mediaSupplyActionRequestSchema, await cmsClient.post<unknown>(`/admin/media/circulation/supply/actions/${encodeURIComponent(actionID)}/cancel`, {}), 'Media Supply action cancellation'); }
export async function listMediaSupplyActionEvents(actionID: string, after = 0, signal?: AbortSignal): Promise<MediaSupplyActionEventPage> { return parseSupplyPayload(mediaSupplyActionEventsSchema, await cmsClient.get<unknown>(`/admin/media/circulation/supply/actions/${encodeURIComponent(actionID)}/events`, { after }, signal), 'Media Supply action events'); }
export async function getMediaSupplyQualificationState(): Promise<MediaSupplyQualificationState> { return parseSupplyPayload(mediaSupplyQualificationStateSchema, await cmsClient.get<unknown>('/admin/media/circulation/supply/qualification'), 'Media Supply qualification'); }

export const mediaSupplySchemas = {
    status: mediaSupplyStatusSchema,
    episodeList: mediaSupplyEpisodeListSchema,
    eligibleActions: mediaSupplyEligibleActionsSchema,
    actionPreview: mediaSupplyActionPreviewSchema,
    actionRequest: mediaSupplyActionRequestSchema,
    actionHistory: mediaSupplyActionHistorySchema,
    actionEvents: mediaSupplyActionEventsSchema,
	qualification: mediaSupplyQualificationStateSchema,
};

/** GET /admin/media/circulation/source-runs/:id/trace — bounded CMS evidence only. */
export async function getMediaSourceRunTrace(id: string): Promise<MediaSourceRunTrace> {
    return cmsClient.get<MediaSourceRunTrace>(`/admin/media/circulation/source-runs/${encodeURIComponent(id)}/trace`);
}

/** GET /admin/media/circulation/intelligence */
export async function getMediaIntelligenceDiagnostics(): Promise<IntelligenceDiagnostics> {
    return cmsClient.get<IntelligenceDiagnostics>('/admin/media/circulation/intelligence');
}

/** GET /admin/media/circulation/policy */
export async function getMediaCirculationPolicy(): Promise<MediaCirculationPolicy> {
    return cmsClient.get<MediaCirculationPolicy>('/admin/media/circulation/policy');
}

/** PUT /admin/media/circulation/policy */
export async function updateMediaCirculationPolicy(data: Partial<MediaCirculationPolicy>): Promise<MediaCirculationPolicy> {
    return cmsClient.put<MediaCirculationPolicy>('/admin/media/circulation/policy', data);
}

/** GET /admin/media/circulation/overrides */
export async function listMediaCirculationOverrides(): Promise<OverrideListResponse> {
    return cmsClient.get<OverrideListResponse>('/admin/media/circulation/overrides');
}

/** POST /admin/media/circulation/overrides */
export async function createMediaCirculationOverride(data: MediaCirculationOverrideRequest): Promise<{ data: MediaCirculationOverride }> {
    return cmsClient.post<{ data: MediaCirculationOverride }>('/admin/media/circulation/overrides', data);
}

/** DELETE /admin/media/circulation/overrides/:id */
export async function deleteMediaCirculationOverride(id: string): Promise<{ success: boolean }> {
    return cmsClient.delete<{ success: boolean }>(`/admin/media/circulation/overrides/${id}`);
}

/** GET /admin/media/circulation/recommendations */
export async function listMediaCirculationRecommendations(params: {
    unit_type?: RecommendationUnitType;
    status?: string;
}): Promise<RecommendationListResponse> {
    return cmsClient.get<RecommendationListResponse>('/admin/media/circulation/recommendations', params);
}

/** POST /admin/media/circulation/recommendations/generate */
export async function generateMediaCirculationRecommendations(): Promise<GenerateRecommendationsResponse> {
    return cmsClient.post<GenerateRecommendationsResponse>('/admin/media/circulation/recommendations/generate');
}

/** POST /admin/media/circulation/recommendations/:id/apply */
export async function applyMediaCirculationRecommendation(id: string): Promise<{ data: MediaCirculationRecommendation }> {
    return cmsClient.post<{ data: MediaCirculationRecommendation }>(`/admin/media/circulation/recommendations/${id}/apply`);
}

/** POST /admin/media/circulation/recommendations/:id/dismiss */
export async function dismissMediaCirculationRecommendation(id: string): Promise<{ data: MediaCirculationRecommendation }> {
    return cmsClient.post<{ data: MediaCirculationRecommendation }>(`/admin/media/circulation/recommendations/${id}/dismiss`);
}

/** POST /admin/media/circulation/recommendations/:id/revert */
export async function revertMediaCirculationRecommendation(id: string): Promise<{ data: MediaCirculationRecommendation }> {
    return cmsClient.post<{ data: MediaCirculationRecommendation }>(`/admin/media/circulation/recommendations/${id}/revert`);
}

// ---- Autopilot (stage 5) ----

/** POST /admin/media/circulation/autopilot/run */
export async function runMediaAutopilotNow(): Promise<{
    data: AutopilotRunDetail;
}> {
    return cmsClient.post<{ data: AutopilotRunDetail }>('/admin/media/circulation/autopilot/run');
}

/** GET /admin/media/circulation/autopilot/runs */
export async function listMediaAutopilotRuns(limit = 20): Promise<{ data: { items: MediaCirculationRun[] } }> {
    return cmsClient.get<{ data: { items: MediaCirculationRun[] } }>('/admin/media/circulation/autopilot/runs', { limit });
}

/** GET /admin/media/circulation/autopilot/runs/:id */
export async function getMediaAutopilotRun(id: string): Promise<{ data: AutopilotRunDetail }> {
    return cmsClient.get<{ data: AutopilotRunDetail }>(`/admin/media/circulation/autopilot/runs/${id}`);
}

/** POST /admin/media/circulation/autopilot/pause — minutes=0 resumes */
export async function pauseMediaAutopilot(minutes: number): Promise<{ data: { paused_until: string | null } }> {
    return cmsClient.post<{ data: { paused_until: string | null } }>('/admin/media/circulation/autopilot/pause', { minutes });
}

/** POST /admin/media/circulation/autopilot/elevate — mode='' clears */
export async function elevateMediaAutopilot(
    mode: MediaAutopilotElevatedMode | '',
    minutes?: number
): Promise<{ data: { mode: string; until: string | null } }> {
    return cmsClient.post<{ data: { mode: string; until: string | null } }>('/admin/media/circulation/autopilot/elevate', { mode, minutes });
}
