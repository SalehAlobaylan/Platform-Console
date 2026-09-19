export type AtomizationStatus =
    | 'unstarted'
    | 'queued'
    | 'waiting_media'
    | 'media_ready'
    | 'waiting_transcript'
    | 'transcript_ready'
    | 'planning'
    | 'cutting'
    | 'renditions'
    | 'children'
    | 'embedding'
    | 'embedding_pending'
    | 'needs_review'
    | 'completed'
    | 'failed'
    | 'archived'
    | string;

export interface AtomizationCount {
    name: string;
    count: number;
}

export interface AtomizationChildStateCount {
    feed_visibility: string;
    status: string;
    count: number;
}

export interface AtomizationDurationBucket {
    bucket: string;
    published: number;
    needs_review: number;
    embedding_pending: number;
}

export interface AtomizationSourcePerformance {
    source_name: string;
    source_feed_url?: string | null;
    parents_processed: number;
    children_produced: number;
    published_count: number;
    review_count: number;
    failed_count: number;
}

export interface MediaAtomizationOverview {
    parent_status_counts: AtomizationCount[];
    child_state_counts: AtomizationChildStateCount[];
    auto_published_count: number;
    review_needed_count: number;
    failed_stuck_count: number;
    duration_violation_count?: number;
    visible_under_floor_count?: number;
    visible_over_hard_max_count?: number;
    short_parent_active_child_count?: number;
    short_chapter_review_count?: number;
    disabled_episode_count?: number;
    disabled_source_count?: number;
    manual_requested_count?: number;
    publication_summary?: MediaPublicationSummary;
    invariants?: MediaAtomizationInvariants;
    policy?: MediaAtomizationPolicySnapshot;
    average_chapters_per_parent: number;
    average_processing_seconds?: number | null;
    duration_distribution: AtomizationDurationBucket[];
    source_performance: AtomizationSourcePerformance[];
    schema_status?: MediaAtomizationSchemaStatus;
    updated_at: string;
}

export type MediaPublicationPath =
    | 'atomized'
    | 'direct_transcript'
    | 'direct_no_transcript'
    | 'blocked_transcript'
    | 'invalid';

export interface MediaPublicationSummary {
    atomized_published_count: number;
    direct_with_transcript_count: number;
    direct_without_transcript_count: number;
    blocked_waiting_transcript_count: number;
    hidden_long_parent_count: number;
    invalid_visible_count: number;
}

export interface MediaAtomizationPolicySnapshot {
    min_feed_unit_seconds: number;
    atomization_min_parent_seconds: number;
    hard_max_feed_unit_seconds: number;
}

export interface MediaAtomizationPolicy {
    chaptering_enabled: boolean;
    auto_publish_high_confidence: boolean;
    parent_feed_visible: boolean;
    preserve_video: boolean;
    remove_sponsor_segments: boolean;
    min_chapter_minutes: number;
    min_feed_unit_seconds: number;
    soft_max_chapter_minutes: number;
    hard_max_chapter_minutes: number;
    atomization_min_parent_seconds: number;
    max_chapters_per_parent: number;
    chaptering_mode: string;
    high_confidence_threshold: number;
    preferred_playback_rendition: string;
    fallback_playback_rendition: string;
    audio_only_allowed: boolean;
}

export type MediaAtomizationPolicyPatch = Partial<MediaAtomizationPolicy>;

export interface MediaAtomizationSourcePolicy {
    id: string;
    name: string;
    type: string;
    feed_url?: string | null;
    is_active: boolean;
    chaptering_enabled: boolean;
    policy: MediaAtomizationPolicy;
    overrides: Record<string, unknown>;
    updated_at: string;
}

export interface MediaAtomizationInvariants {
    visible_under_floor_feed_units: number;
    visible_over_hard_max_feed_units: number;
    parents_under_40m_with_children: number;
    short_chapters_awaiting_review: number;
}

export interface MediaAtomizationSchemaStatus {
    ready: boolean;
    missing: string[];
    message: string;
}

export interface MediaAtomizationRepairResult {
    updated_count: number;
    remaining_count: number;
    hidden_duration_violation_count?: number;
    archived_short_parent_child_count?: number;
    restored_parent_count?: number;
    restored_fuzzy_chapter_count?: number;
    remaining_visible_under_floor_count?: number;
    remaining_visible_over_hard_max_count?: number;
    schema_status?: MediaAtomizationSchemaStatus;
}

export interface MediaAtomizationSweepResult {
    success?: boolean;
    jobId?: string;
    message?: string;
}

export interface MediaAtomizationParent {
    id: string;
    title?: string | null;
    status: string;
    chaptering_status?: AtomizationStatus | null;
    source_name?: string | null;
    source_feed_url?: string | null;
    duration_sec?: number | null;
    transcript_id?: string | null;
    child_count: number;
    child_duration_sec?: number | null;
    coverage_percent?: number | null;
    published_count: number;
    review_count: number;
    embedding_pending_count: number;
    latest_error?: string | null;
    atomization_override?: 'inherit' | 'disabled' | 'enabled' | string | null;
    atomization_override_reason?: string | null;
    manual_atomization_requested_at?: string | null;
    updated_at: string;
}

export interface MediaAtomizationChapter {
    id: string;
    title: string;
    summary?: string | null;
    parent_id: string;
    parent_title?: string | null;
    child_id?: string | null;
    source_name?: string | null;
    status: string;
    feed_visibility?: string | null;
    confidence?: number | null;
    start_ms: number;
    end_ms?: number | null;
    duration_ms: number;
    duration_bucket?: string | null;
    needs_review_reason?: string | null;
    playback_url?: string | null;
    playback_type?: string | null;
    fallback_playback_url?: string | null;
    has_video?: boolean | null;
    updated_at: string;
}

export interface MediaAtomizationRun {
    id: string;
    tenant_id: string;
    parent_content_item_id: string;
    status: string;
    phase: string;
    child_count: number;
    review_count: number;
    error_message?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface MediaAtomizationFeedUnit {
    id: string;
    title?: string | null;
    source_name?: string | null;
    duration_sec?: number | null;
    transcript_id?: string | null;
    transcript_state: 'ready' | 'missing' | string;
    publication_path: MediaPublicationPath | string;
    feed_visibility: string;
    status: string;
    parent_id?: string | null;
    parent_title?: string | null;
    child_count: number;
    latest_error?: string | null;
    playback_url?: string | null;
    playback_type?: string | null;
    fallback_playback_url?: string | null;
    has_video?: boolean | null;
    updated_at: string;
}

export interface MediaAtomizationContextFeedUnit {
    id: string;
    title?: string | null;
    status: string;
    feed_visibility: string;
    duration_sec?: number | null;
    duration_bucket?: string | null;
    chapter_index?: number | null;
    chapter_start_ms?: number | null;
    chapter_end_ms?: number | null;
    playback_url?: string | null;
    playback_type?: string | null;
    fallback_playback_url?: string | null;
    has_video?: boolean | null;
    updated_at?: string | null;
}

export interface MediaAtomizationContextChapter {
    id?: string;
    title: string;
    summary?: string | null;
    start_ms: number;
    end_ms: number;
    status?: string;
    confidence?: number | null;
    duration_bucket?: string | null;
    child_content_item_id?: string | null;
}

export interface MediaAtomizationParentContext {
    parent?: Partial<MediaAtomizationParent> & {
        media_url?: string | null;
        thumbnail_url?: string | null;
        playback_url?: string | null;
        playback_type?: string | null;
        fallback_playback_url?: string | null;
        has_video?: boolean | null;
    };
    effective_policy?: MediaAtomizationPolicy;
    policy_source?: string;
    atomization_disabled_reason?: string | null;
    manual_requested?: boolean;
    transcript?: {
        transcript_id: string;
        language?: string | null;
        source?: string | null;
        provider?: string | null;
        approved_at?: string | null;
        approved_by?: string | null;
        approval_reason?: string | null;
    } | null;
    chapters: MediaAtomizationContextChapter[];
    children: MediaAtomizationContextFeedUnit[];
    recent_runs: MediaAtomizationRun[];
    selected_chapter?: MediaAtomizationContextChapter | null;
    selected_child?: MediaAtomizationContextFeedUnit | null;
    schema_status?: MediaAtomizationSchemaStatus;
}

export interface MediaAtomizationPipelineItem {
    id: string;
    lane?: string;
    current_phase?: string;
    disposition?: 'active' | 'parked_transcript' | 'parked_review' | 'parked_failed' | 'reconciling' | 'published' | 'cancelled' | string;
    parked_reason?: string;
    title?: string | null;
    status: string;
    chaptering_status?: AtomizationStatus | null;
    source_name?: string | null;
    duration_sec?: number | null;
    transcript_id?: string | null;
    transcript_state: string;
    child_count: number;
    child_duration_sec?: number | null;
    coverage_percent?: number | null;
    published_count: number;
    review_count: number;
    embedding_pending_count: number;
    latest_error?: string | null;
    run_status?: string | null;
    run_phase?: string | null;
    media_stage_state?: string | null;
    media_stage_phase?: string | null;
    transcript_stage_state?: string | null;
    atomization_stage_state?: string | null;
    active_attempt_id?: string | null;
    generation_id?: string | null;
    historical_failure_count?: number;
    expected_chapter_count?: number;
    verified_chapter_count?: number;
    failed_or_stuck?: boolean;
    atomization_override?: 'inherit' | 'disabled' | 'enabled' | string | null;
    atomization_override_reason?: string | null;
    manual_atomization_requested_at?: string | null;
    updated_at: string;
    age_seconds: number;
    processing_generation?: number;
    last_progress_at?: string;
    primary_action: string;
    allowed_actions?: Array<'inspect' | 'download' | 'approve_transcript' | 'review' | 'retry_atomization'>;
    blocked_reason?: string;
    blocking_reason?: string;
    retryable?: boolean;
    action_href: string;
}

export interface MediaAtomizationPipelineColumn {
    key: string;
    label: string;
    count: number;
    items: MediaAtomizationPipelineItem[];
    displayed_count?: number;
    next_cursor?: string;
}

export interface MediaAtomizationPipeline {
    columns: MediaAtomizationPipelineColumn[];
    schema_status?: MediaAtomizationSchemaStatus;
    updated_at: string;
}

export interface AtomizationFilters {
	parent_id?: string;
    status?: string;
    source?: string;
    bucket?: string;
    review?: string;
    path?: string;
    q?: string;
}
