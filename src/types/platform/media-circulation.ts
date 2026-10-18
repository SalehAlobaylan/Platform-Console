import type { StorageProofMetrics } from './storage';

export interface MediaSourceDiversityRow {
    source_id: string;
    source_name: string;
    active: boolean;
    explicitly_scheduled: boolean;
    outside_intake_circuit: boolean;
    provider_successful_within_7d: boolean;
    fetched_candidates_30d: number;
    legal_candidates_30d: number;
    filtered_candidates_30d: number;
    materialized_items_30d: number;
    verified_media_30d: number;
    ready_visible_units_30d: number;
    producing: boolean;
    failing_boundary: string;
    gap_reason?: string;
    scheduling_diagnostics_url: string;
    discovery_url: string;
    pending_suggestions_url: string;
}

export interface MediaSourceDiversity {
    tenant_id: string;
    target_producing_sources: number;
    producing_source_count: number;
    gap: number;
    qualified: boolean;
    generated_at: string;
    approval_policy: string;
    sources: MediaSourceDiversityRow[];
}

export type MediaCirculationHeadline = 'healthy' | 'watch' | 'feed_thin' | 'over_budget' | 'degraded';

export type RecommendationUnitType = 'source' | 'item_family';

export interface LibraryBucketHealth {
    bucket: string;
    visible_units: number;
    state: 'thin' | 'ok' | 'saturated' | string;
    /** Demand surface (stage 4) — measured serve-side demand in [0,1]. */
    demand_score: number;
    /** Value-weighted supply in [0,1] (10 junk units ≠ 10 good units). */
    coverage_score: number;
    /** demand − coverage, in [-1,1]. Positive = under-supplied. */
    gap: number;
    /** True once enough serve telemetry accumulated; false = estimated from supply counts. */
    measured: boolean;
}

/** One row of the per-topic demand table (Ranking/Intelligence diagnostics). */
export interface TopicDemand {
    topic: string;
    serves: number;
    repeat_serves: number;
    demand_score: number;
    coverage_score: number;
    gap: number;
    visible_units: number;
}

/** GET /admin/media/circulation/intelligence — observability read model. */
export interface IntelligenceDiagnostics {
    exploring_count: number;
    established_count: number;
    retrial_count: number;
    demoted_count: number;
    scored_count: number;
    unscored_count: number;
    stale_count: number;
    oldest_computed_at?: string;
    demand_measured: boolean;
    topic_demand: TopicDemand[];
}

export interface MediaCirculationPolicy {
    tenant_id?: string;
    enabled: boolean;
    preset: 'conservative' | 'balanced' | 'intake_hungry' | string;
    value_floor: number;
    marginal_margin: number;
    max_intake_per_source_per_cycle: number;
    max_intake_per_cycle: number;
    source_min_interval_minutes: number;
    source_max_interval_minutes: number;
    freshness_demand_weight: number;
    // ---- Autopilot (stage 5) ----
    autopilot_enabled: boolean;
    autopilot_mode: 'observe' | 'safe_auto' | string;
    autopilot_interval_minutes: number;
    autopilot_max_actions_per_run: number;
    autopilot_max_atomize_per_run: number;
    autopilot_max_queue_depth: number;
    autopilot_max_bytes_per_run: number;
    autopilot_evict_confidence_floor: number;
    autopilot_trust_min_decisions: number;
    autopilot_trust_max_revert_pct: number;
    autopilot_paused_until?: string | null;
    autopilot_elevated_mode?: MediaAutopilotElevatedMode | '' | null;
    autopilot_elevated_until?: string | null;
    autopilot_last_run_at?: string | null;
    last_evaluated_at?: string | null;
    last_generated_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

// ---- Autopilot (stage 5) ----

export type MediaAutopilotElevatedMode = 'storage_relief' | 'quality_repair' | 'atomization_catchup';

export type MediaAutopilotActionStatus = 'running' | 'success' | 'error' | 'skipped' | 'approval_required' | 'would_apply' | 'would_skip';

export interface MediaAutopilotTrustStat {
    verdict: string;
    decisions: number;
    applied: number;
    reverts: number;
    revert_pct: number;
    earned: boolean;
}

export interface MediaCirculationRun {
    id: string;
    tenant_id: string;
    trigger: 'scheduled' | 'manual' | string;
    mode: 'observe' | 'safe_auto' | string;
    elevated_mode?: string;
    status: 'running' | 'completed' | 'partial' | 'failed' | string;
    started_at: string;
    finished_at?: string | null;
    summary?: string;
    health_before?: unknown;
    health_after?: unknown;
    created_by?: string;
    error?: string;
}

export interface MediaCirculationAction {
    id: string;
    tenant_id: string;
    recommendation_id?: string | null;
    tool_name: string;
    status: MediaAutopilotActionStatus | string;
    reason?: string;
    guardrail?: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    byte_impact: number;
    queue_impact: number;
    feed_impact: number;
    started_at: string;
    finished_at?: string | null;
}

export interface MediaAutopilotStatus {
    enabled: boolean;
    mode: 'observe' | 'safe_auto' | string;
    state: 'off' | 'observe' | 'safe_auto' | 'elevated' | 'paused' | string;
    interval_minutes: number;
    elevated_mode?: string;
    elevated_until?: string | null;
    paused_until?: string | null;
    last_run_at?: string | null;
    next_run_at?: string | null;
    last_run?: MediaCirculationRun | null;
    trust: MediaAutopilotTrustStat[];
    recommended_action?: string;
}

export interface AutopilotRunDetail {
    run: MediaCirculationRun;
    actions: MediaCirculationAction[];
}

export interface OpBudgetStatus {
    class_a_status: 'ok' | 'warn' | 'cap' | string;
    class_b_status: 'ok' | 'warn' | 'cap' | string;
    class_a_used: number;
    class_b_used: number;
    class_a_remaining: number;
    class_b_remaining: number;
    class_a_budget: number;
    class_b_budget: number;
}

export interface AtomizationBacklog {
    pending_runs: number;
    running_runs: number;
    transcript_wait_count: number;
    backlog_depth: number;
    intake_dampening_factor: number;
}

export interface BucketYield {
    predicted: number;
    delivered: number;
}

export interface MediaCirculationProof {
    storage: StorageProofMetrics;
    op_budget: OpBudgetStatus;
    atomization_backlog: AtomizationBacklog;
    buckets: LibraryBucketHealth[];
    thin_buckets: string[];
    evict_by_verdict: Record<string, number>;
    applied_yield_by_bucket?: Record<string, BucketYield>;
}

export interface MediaCirculationHealth {
    headline: MediaCirculationHeadline | string;
    score: number;
    summary: string;
    storage_state: string;
    reasons: string[];
    generated_at: string;
    proof: MediaCirculationProof;
    policy: MediaCirculationPolicy;
}

export interface MediaCirculationRecommendation {
    id: string;
    tenant_id: string;
    unit_type: RecommendationUnitType | string;
    subject_id: string;
    subject_kind?: string;
    verdict: string;
    action: string;
    score: number;
    reasons?: string[];
    metrics?: Record<string, unknown>;
    status: string;
    outcome?: string;
    applied: boolean;
    applied_at?: string | null;
    applied_by?: string;
    created_at: string;
    updated_at: string;
}

export type RecommendationActionLane = 'pull' | 'atomize' | 'limit_skip' | 'protect' | 'cool' | 'downrank' | 'review' | string;

export interface MediaCirculationCockpitHealth {
    headline: MediaCirculationHeadline | string;
    score: number;
    summary: string;
    reasons: string[];
    generated_at: string;
    enabled: boolean;
}

export interface MediaCirculationCockpitBucket extends LibraryBucketHealth {
    thin_floor: number;
    saturated_ceil: number;
    share_pct: number;
}

export interface MediaCirculationCockpitSummary {
    total: number;
    pending: number;
    applied: number;
    dismissed: number;
    superseded: number;
    by_unit_type: Record<string, number>;
    by_verdict: Record<string, number>;
    by_status: Record<string, number>;
    by_action_lane: Record<string, number>;
    needs_attention: number;
}

export interface MediaCirculationCockpitRecommendation extends MediaCirculationRecommendation {
    display_title: string;
    display_subtitle: string;
    action_lane: RecommendationActionLane;
    priority_label: string;
    primary_metric: string;
    proof_points: string[];
}

/** CMS-owned evidence for the final source-run → public Pods boundary. */
export interface MediaCirculationDeliveryProofItem {
    request_id: string;
    source_id: string;
    source_name: string;
    request_state: string;
    evidence_state: string;
    delivery_state: 'verified' | 'pending' | 'degraded' | 'not_observed' | string;
    reason: string;
    ingest_verdict?: string;
    pods_verdict?: string;
	terminal_outcome?: string;
    observation_attempts: number;
    requested_at: string;
    ingest_observed_at?: string | null;
    pods_observed_at?: string | null;
    next_observation_at?: string | null;
}

export interface MediaCirculationDeliveryProof {
    generated_at: string;
    verified: number;
    pending: number;
    degraded: number;
    not_observed: number;
    last_verified_at?: string | null;
    items: MediaCirculationDeliveryProofItem[];
}

/** CMS scheduling facts; no queue inference or provider-health claim. */
export interface MediaCirculationSourceScheduleProofItem {
    source_id: string;
    source_name: string;
    schedule_state: 'due_unadmitted' | 'in_flight' | 'scheduled' | 'paused' | 'unknown' | string;
    reason: string;
    next_due_at?: string | null;
    last_claimed_at?: string | null;
    last_attempted_at?: string | null;
    last_provider_success_at?: string | null;
	last_upstream_observed_at?: string | null;
	last_no_change_at?: string | null;
    last_new_item_at?: string | null;
    last_delivery_verified_at?: string | null;
    intake_circuit_until?: string | null;
    latest_request_id?: string | null;
    latest_request_state?: string;
}

export interface MediaCirculationSourceScheduleProof {
    generated_at: string;
    available: boolean;
    unavailable_reason?: string;
    due_unadmitted: number;
    in_flight: number;
    scheduled: number;
    paused: number;
    unknown: number;
    items: MediaCirculationSourceScheduleProofItem[];
}

/** CMS-owned Supply Continuity verdict. This is evidence only, never a retry capability. */
export interface MediaSupplyEvaluationCounts {
    due_unadmitted: number;
    in_flight: number;
    scheduled: number;
    paused: number;
    schedule_unknown: number;
    delivery_verified: number;
    delivery_pending: number;
    delivery_degraded: number;
    delivery_unknown: number;
	no_upstream_change: number;
	upstream_deferred: number;
	intake_blocked: number;
}

export interface MediaSupplyEvaluation {
    schema_version: 'media-supply/v1' | string;
    evaluated_at: string;
    verdict: string;
    headline_boundary: string;
    owner: string;
    evidence_completeness: 'complete' | 'partial' | 'unavailable' | string;
    read_only: true;
    summary: string;
    counts: MediaSupplyEvaluationCounts;
    affected_source_ids: string[];
    affected_request_ids: string[];
    unknowns: string[];
}

export interface MediaSupplySubject {
    type: 'content_source' | 'source_run_request' | string;
    id: string;
}

export interface MediaSupplyEpisode {
    id: string;
    tenant_id: string;
    fingerprint: string;
    first_failed_boundary: string;
    verdict: string;
    severity: 'info' | 'warning' | 'major' | 'critical' | string;
    owner: string;
    state: 'open' | 'recovering' | 'resolved' | string;
    summary: string;
    affected_subjects: MediaSupplySubject[];
    evidence_digest: string;
    evidence_completeness: 'complete' | 'partial' | 'unavailable' | string;
    evidence: unknown;
    first_seen_at: string;
    last_seen_at: string;
    slo_deadline_at?: string | null;
    resolved_at?: string | null;
    resolution_proof?: unknown;
    created_at: string;
    updated_at: string;
}

/** Latest durable CMS proof that the bounded Supply evaluator is observing. */
export interface MediaSupplyEvaluatorStatus {
    recording_enabled: boolean | null;
    worker_state: 'ready' | 'stale' | 'not_started' | string;
    worker_last_heartbeat_at?: string | null;
    worker_stale_after_at?: string | null;
    last_outcome?: 'evaluated' | 'disabled' | 'control_unavailable' | 'record_failed' | string;
    last_trigger?: 'scheduled' | 'manual' | string;
    last_observed_at?: string | null;
    last_evaluated_at?: string | null;
    evaluation_digest?: string | null;
    unknowns: string[];
}

export interface MediaSupplyOperationalHealth {
    state: 'ready' | 'attention' | 'degraded';
    workers: Record<string, 'ready' | 'stale'>;
	owners: Record<string, {
		state: 'ready' | 'stale' | 'not_started';
		observed_at?: string | null;
		stale_after_at?: string | null;
		detail?: string;
	}>;
    backlogs: Record<string, number>;
	metrics: {
		schema_version: 'media-supply-operational-metrics/v1';
		generated_at: string;
		samples: Array<{
			name: string;
			owner: 'cms' | 'aggregation' | 'media_enrichment';
			action: 'source_run' | 'supply_action' | 'pipeline_repair' | 'artifact_coverage' | 'atomization' | 'consumer_boundary' | 'supply_episode';
			stage: 'admission' | 'dispatch' | 'receipt' | 'provider' | 'pipeline' | 'execution' | 'control' | 'verification' | 'return' | 'render' | 'view' | 'evaluation';
			verdict: 'open' | 'expired' | 'retained' | 'pending' | 'cancelled' | 'blocked' | 'failed' | 'present';
			value: number;
			unit: 'count' | 'seconds';
		}>;
		truncated: boolean;
		unknowns: string[];
	};
    unknowns: string[];
    generated_at: string;
}

export interface MediaSupplyStatusResponse {
    supply_evaluation: MediaSupplyEvaluation;
    schedules: MediaCirculationSourceScheduleProof;
    delivery: MediaCirculationDeliveryProof;
    evaluator: MediaSupplyEvaluatorStatus;
	operational: MediaSupplyOperationalHealth;
	exposure: {
		schema_version: 'pods-exposure/v2'; generated_at: string; verdict: string; evidence_completeness: 'complete' | 'partial' | 'unavailable';
		base_eligible_count: number; reachable_count: number; returned_count: number; distinct_returned_count: number;
		eligible_returned_gap: number; repeat_pressure: number; active_generation_id?: string | null; probe_id: string;
		newest_eligible_at?: string | null; newest_reachable_at?: string | null; newest_returned_at?: string | null; last_feed_rendered_at?: string | null; last_exact_view_at?: string | null;
		returned_ids: string[]; rendered_ids: string[]; viewed_ids: string[]; unknowns: string[];
	};
}

export interface MediaSupplyEpisodeListResponse {
    schema_version: 'media-supply/v1' | string;
    items: MediaSupplyEpisode[];
    next_cursor: string;
}

export interface MediaSupplyEligibleAction {
    id: string;
    key: string;
    target_type: string;
    risk: string;
    execution_owner: string;
    affected_domains: string[];
    manual_only: boolean;
    disabled: boolean;
    disabled_control?: string;
}

export interface MediaSupplyActionPreview {
    id: string;
    action_key: string;
    target_type: string;
    target_id: string;
    evidence_digest: string;
    policy_digest: string;
    state: 'active' | 'consumed' | 'invalidated';
    expires_at: string;
    planned_effects: Record<string, unknown>;
    affected_subjects: unknown[];
    deep_links: string[];
}

export interface MediaSupplyActionRequest {
    id: string;
    action_key: string;
    target_type: string;
    target_id: string;
    execution_owner: string;
    state: 'queued' | 'claimed' | 'running' | 'verifying' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain' | string;
    planned_effects: Record<string, unknown>;
    before_effects?: Record<string, unknown>;
    after_effects?: Record<string, unknown>;
    verified_effects?: {
		schema_version: 'media-supply-verified-effects/v1';
		proof?: unknown;
		affected_domains: string[];
		affected_subjects: Array<{ type: string; id: string }>;
		deep_links: string[];
	};
    affected_subjects: unknown[];
	affected_domains: string[];
    deep_links: string[];
    created_at: string;
    updated_at: string;
    finished_at?: string | null;
}

export interface MediaSupplyQualificationState {
	schema_version: 'media-supply-qualification/v1';
	safe_auto_default: 'disabled';
	reports: Array<{
		id: string; tenant_id: string; action_key: string; action_version: string; adapter_version: string;
		verifier_version: string; schema_version: string; policy_version: string;
		environment_identity: string; build_identity: string; state: string;
		report_digest: string; seal?: string; created_at: string; sealed_at?: string | null;
	}>;
	promotions: Array<{
		id: string; tenant_id: string; action_key: string; action_version: string;
		environment_identity: string; build_identity: string;
		state: string; promotion_epoch: number; report_digest: string;
		promoted_at: string; demoted_at?: string | null; demotion_reason?: string;
	}>;
}

export interface MediaSupplyActionEventPage {
    id: string;
    state: string;
    events: Array<{ id: string; sequence: number; event_type: string; payload: Record<string, unknown>; occurred_at: string }>;
    next_sequence: number;
}

export interface MediaSourceRunTraceRequest {
    id: string;
    source_id: string;
    source_name: string;
    state: string;
    evidence_state: string;
    lane: string;
    purpose: string;
    requested_at: string;
    accepted_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    verified_at?: string | null;
    failure_class?: string;
    failure_summary?: string;
}

export interface MediaSourceRunTraceAttempt {
    id: string;
    number: number;
    state: string;
    started_at?: string | null;
    finished_at?: string | null;
    verification_required_at?: string | null;
    failure_class?: string;
    failure_summary?: string;
}

export interface MediaSourceRunTraceUnit {
    id: string;
    attempt_id: string;
    parent_unit_id?: string | null;
    unit_type: string;
    page_id?: string;
    batch_id?: string;
    state: string;
    verification_required: boolean;
    terminal_outcome?: string;
    effect_started_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
}

export interface MediaSourceRunTraceReceipt {
    id: string;
    attempt_id: string;
    unit_id: string;
    content_id?: string | null;
    stage: string;
    event_type: string;
    outcome: string;
    sequence: number;
    page_id?: string;
    batch_id?: string;
    final_page: boolean;
    causation_id?: string;
    produced_at: string;
    observed_at: string;
}

export interface MediaSourceRunTraceVerification {
    id: string;
    attempt_id?: string | null;
    unit_id?: string | null;
    stage: string;
    evidence_boundary: string;
    causation_id: string;
    state: string;
    attempt_count: number;
    not_before_at?: string | null;
    deadline_at?: string | null;
    terminal_verdict?: string;
    created_at: string;
}

export interface MediaSourceRunTraceReconciliation {
    id: string;
    attempt_id?: string | null;
    unit_id?: string | null;
    task_id: string;
    stage: string;
    verdict: string;
    scope_type: string;
    scope_id: string;
    causation_id: string;
    observed_at: string;
}

export interface MediaSourceRunTraceItem {
    id: string;
    parent_id?: string | null;
    type: string;
    status: string;
    title?: string;
    is_feed_unit: boolean;
    feed_visibility: string;
    chaptering_status?: string | null;
    created_at: string;
}

/** Bounded, redacted CMS source-run evidence. It contains no queue or provider payload. */
export interface MediaSourceRunTrace {
    schema_version: 'media-source-run-trace/v1' | string;
    generated_at: string;
    request: MediaSourceRunTraceRequest;
    truncation: {
        attempts: boolean;
        units: boolean;
        receipts: boolean;
        verification_tasks: boolean;
        reconciliation_events: boolean;
        attributed_items: boolean;
    };
    attempts: MediaSourceRunTraceAttempt[];
    units: MediaSourceRunTraceUnit[];
    receipts: MediaSourceRunTraceReceipt[];
    verification_tasks: MediaSourceRunTraceVerification[];
    reconciliation_events: MediaSourceRunTraceReconciliation[];
    attributed_items: MediaSourceRunTraceItem[];
}

export interface MediaCirculationCockpit {
    health: MediaCirculationCockpitHealth;
    storage: StorageProofMetrics;
    op_budget: OpBudgetStatus;
    atomization_backlog: AtomizationBacklog;
    applied_yield_by_bucket?: Record<string, BucketYield>;
    buckets: MediaCirculationCockpitBucket[];
    summary: MediaCirculationCockpitSummary;
    policy: MediaCirculationPolicy;
    recommendations: MediaCirculationCockpitRecommendation[];
    autopilot: MediaAutopilotStatus;
    /** Optional so a Console deployed ahead of CMS degrades without inventing delivery status. */
    delivery?: MediaCirculationDeliveryProof;
    schedules?: MediaCirculationSourceScheduleProof;
}

export interface MediaCirculationOverride {
    id: string;
    tenant_id: string;
    subject_kind: 'source' | 'item' | 'family' | string;
    subject_id: string;
    override_type: 'never_archive' | 'keep_latest_n_hot' | 'premium_source' | 'no_atomize' | 'editorial_hold' | string;
    params?: Record<string, unknown>;
    expires_at?: string | null;
    set_by?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface MediaCirculationOverrideRequest {
    subject_kind: string;
    subject_id: string;
    override_type: string;
    params?: Record<string, unknown>;
    expires_at?: string | null;
    notes?: string;
}

export interface OverrideListResponse {
    data: MediaCirculationOverride[];
}

export interface RecommendationListResponse {
    data: MediaCirculationRecommendation[];
}

export interface VerdictBucketCount {
    count: number;
    by_verdict: Record<string, number>;
}

export interface GenerateRecommendationsResponse {
    data: {
        item_family: VerdictBucketCount;
        source: VerdictBucketCount;
    };
}

export interface MediaSupplyActionHistoryPage {
 schema_version: 'media-supply-action-history/v1';
 episode_id: string;
 items: MediaSupplyActionRequest[];
 next_cursor: string;
}
