export type RetentionMode = 'observe' | 'assist' | 'safe_auto';
export type RetentionVerdict =
    | 'healthy'
    | 'warning'
    | 'action_required'
    | 'compaction_due'
    | 'archive_blocked'
    | 'cleanup_due'
    | 'recovery_required'
    | 'blocked'
    | 'critical'
    | 'maintenance_required'
    | 'recovery_in_progress'
    | 'inconclusive';

export interface RetentionPolicy {
    id?: string;
    tenant_id: string;
    enabled: boolean;
    mode: RetentionMode;
    schedule_interval_minutes: number;
    paused_until?: string | null;
    last_run_at?: string | null;
    policy_version: number;
    news_timezone: string;
    database_target_bytes: number;
    database_warning_bytes: number;
    database_action_bytes: number;
    database_critical_bytes: number;
    warning_forecast_days: number;
    action_forecast_days: number;
    critical_forecast_hours: number;
    max_rows_per_run: number;
    max_bytes_per_run: number;
    max_actions_per_run: number;
    action_modes?: Record<string, RetentionMode>;
    trust_min_decisions?: number;
    trust_min_agreement_pct?: number;
    updated_by?: string;
}

export type RetentionPolicyPatch = Partial<Omit<RetentionPolicy, 'mode' | 'action_modes' | 'trust_min_decisions' | 'trust_min_agreement_pct'>> & { mode?: 'observe' | 'assist' };
export type PreparedRetentionManifest<T> = T & { run_id: string; action_id: string };

export interface RetentionExecutionControl {
    tenant_id: string;
    canonical_compaction_enabled: boolean;
    historical_enabled: boolean;
    owner_runs_enabled: boolean;
    feed_recovery_rotate_enabled: boolean;
    feed_recovery_purge_enabled: boolean;
    updated_by?: string;
    updated_at?: string;
}

export interface RetentionDBSample {
    id: string;
    database_bytes: number;
    provider_bytes?: number | null;
    provider_source: 'supabase_api' | 'neon_api' | 'operator_readback' | 'unavailable';
    relation_bytes: number;
    index_bytes: number;
    toast_bytes: number;
    allocated_bytes: number;
    reusable_bytes: number;
    live_tuples: number;
    dead_tuples: number;
    relation_breakdown?: Array<{
        schema_name: string;
        table_name: string;
        total_bytes: number;
        index_bytes: number;
        toast_bytes: number;
    }>;
    measured_at: string;
}

export interface RetentionForecast {
    growth_bytes_per_day: number;
    runway_to_target_days?: number | null;
    runway_to_action_days?: number | null;
    runway_to_critical_days?: number | null;
    sample_count: number;
    window_hours: number;
}

export interface RetentionPreview {
    eligible_stories: number;
    candidate_rows: number;
    estimated_bytes: number;
    protected_rows: number;
    blocked_stories: number;
}

export interface RetentionRun {
    id: string;
    correlation_id: string;
    trigger: string;
    mode: RetentionMode;
    status: string;
    verdict: RetentionVerdict;
    policy_version: number;
    counts?: RetentionPreview;
    after_evidence?: Record<string, unknown>;
    started_at: string;
    finished_at?: string | null;
    error?: string;
}

export interface RetentionAction {
    id: string;
    action_class: string;
    owner_system: string;
    target_scope: string;
    mode: RetentionMode;
    decision: string;
    outcome: string;
    target_count: number;
    protected_count: number;
    estimated_bytes: number;
    guardrail?: string;
    manifest_hash?: string | null;
    approved_at?: string | null;
    verification?: Record<string, unknown>;
    created_at: string;
}

export interface RetentionHold {
    id: string;
    target_type: 'content' | 'story' | 'month';
    target_id: string;
    hold_class: 'manual' | 'editorial' | 'legal' | 'moderation' | 'recovery';
    reason: string;
    created_by: string;
    expires_at?: string | null;
    created_at: string;
}

export interface RetentionCompactionManifest {
    id: string;
    manifest_hash: string;
    state: 'prepared' | 'approved' | 'expired' | 'executed' | 'blocked';
    story_ids: string[];
    anchor_content_ids: string[];
    protected_content_ids: string[];
    retire_content_ids: string[];
    policy_version: number;
    timezone: string;
    story_count: number;
    anchor_count: number;
    protected_count: number;
    retire_count: number;
    estimated_bytes: number;
    expires_at: string;
    evidence?: { stories?: Array<{ story_id: string; lead_id: string; representative_ids: string[]; protected_ids: string[]; retire_ids: string[] }>; next_cursor?: string; has_more?: boolean; [key: string]: unknown };
}

export interface RetentionHistoricalManifest {
    id: string;
    manifest_hash: string;
    state: 'prepared' | 'approved' | 'expired' | 'executed' | 'blocked';
    content_ids: string[];
    story_ids: string[];
    policy_version: number;
    timezone: string;
    content_count: number;
    story_count: number;
    estimated_bytes: number;
    expires_at: string;
    evidence?: { next_cursor?: string; has_more?: boolean; [key: string]: unknown };
}

export interface RetentionMaintenanceReport {
    id: string;
    database_bytes: number;
    target_bytes: number;
    sparse_use_count: number;
    provider_bytes?: number | null;
    provider_source?: string;
    provider_measured_at?: string | null;
    provider_fresh?: boolean;
    postgres_ready?: boolean;
    provider_ready?: boolean;
    blocking_reasons?: string[];
    state: 'not_ready' | 'free_downgrade_ready';
    evidence?: Record<string, unknown>;
    created_at: string;
}

export interface RetentionOwnerRequest {
    id: string;
    action_id?: string;
    owner_system: 'storage' | 'media_circulation';
    allowed_action_classes?: string[];
    max_bytes?: number;
    max_items?: number;
    max_actions?: number;
    correlation_id?: string;
    expires_at?: string;
    request_hash?: string;
    status: string;
    result?: Record<string, unknown>;
    created_at: string;
}

export interface RetentionStatus {
    policy: RetentionPolicy;
    latest_sample?: RetentionDBSample | null;
    latest_run?: RetentionRun | null;
    forecast: RetentionForecast;
    verdict: RetentionVerdict;
    preview: RetentionPreview;
    capacity_verdict?: RetentionVerdict;
    historical?: Record<string, unknown>;
    latest_maintenance?: RetentionMaintenanceReport | null;
    execution_controls: RetentionExecutionControl;
    paused: boolean;
    observe_only: boolean;
    satellite_evaluation: RetentionSatelliteEvaluation;
    guarantees: {
        full_fidelity_days: number;
        history_retention_days: number;
        canonical_row_deletion: string;
        sources_preserved: boolean;
        physical_rewrites: string;
    };
}

export interface RetentionSatelliteEvaluation {
    state: string;
    completed_cycles: number;
    required_cycles: number;
    recommendation: string;
    reason: string;
}

export interface MonthlyReviewPolicyConfig {
    formula_version: 'v1';
    importance_weight: number;
    engagement_weight: number;
    category_cap: number;
    lead_source_cap: number;
    target_min: 20;
    target_max: 30;
}

export interface MonthlyReviewPolicyVersion {
    id: string;
    tenant_id: string;
    version: number;
    state: string;
    config: MonthlyReviewPolicyConfig;
    reason?: string;
    created_by?: string;
    effective_at: string;
}

export interface MonthlyReviewArchive {
    id: string;
    month_start: string;
    revision: number;
    state: string;
    limited_coverage: boolean;
    headline: string;
    selected_count: number;
    qualified_count: number;
    finalized_at?: string | null;
}

export interface RetentionActionReview {
    action_id: string;
    run_id: string;
    action_class: string;
    outcome: string;
    approved_at?: string | null;
    approved_by?: string;
    manifest: RetentionCompactionManifest | RetentionHistoricalManifest;
}
