// Feeds Finding — auto source discovery types.

export interface DiscoveryProfile {
    id: string;
    name: string;
    description: string;
    keywords: string[];
    languages: string[];
    category: 'news' | 'media';
    enabled: boolean;
    max_suggestions_per_run: number;
    last_run_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateProfileRequest {
    name: string;
    description?: string;
    keywords?: string[];
    languages?: string[];
    category?: 'news' | 'media';
    enabled?: boolean;
    max_suggestions_per_run?: number;
}

export type UpdateProfileRequest = Partial<CreateProfileRequest>;

export interface SuggestionSampleItem {
    title: string;
    url?: string;
    published_at?: string | null;
}

export interface SuggestionHealth {
    items_count?: number;
    last_item_at?: string | null;
    parse_ok?: boolean;
    // Media (Pods) channel signals stashed by the YouTube/podcast contributors.
    bio?: string; // channel/show title (friendly display name)
    subscribers?: number;
    image?: string;
    // Audio-first detection (YouTube): talk-driven (works as audio) vs visual
    // (Music/Gaming/Sports). category = the dominant sampled YouTube category.
    audio_first?: boolean;
    category?: string;
    duration_sec?: number;
    // YouTube tagged it a podcast, or it was found via podcast-intent search / a
    // pasted podcast shelf — drives the card's "Podcast" badge.
    is_podcast?: boolean;
    episode_count?: number;
}

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SuggestionEvidence {
    citation_count?: number;
    cocitation_count?: number;
    authority?: number;
    relevance?: number;
    composite?: number;
    trend?: string;
    via?: string[];
    subscribers?: number;
    // Deterministic source classification: official | news | person | other.
    source_class?: string;
    // Media (Pods) signals.
    caption_state?: 'youtube_human' | 'youtube_auto' | 'none';
    needs_chaptering?: boolean;
    median_duration_sec?: number;
}

export interface SourceSuggestion {
    id: string;
    profile_id?: string;
    name: string;
    type: string;
    feed_url: string;
    site_url?: string;
    image_url?: string;
    language?: string;
    confidence: number;
    relevance_score?: number;
    health?: SuggestionHealth;
    sample_items?: SuggestionSampleItem[];
    evidence?: SuggestionEvidence;
    discovered_via?: string;
    category?: 'news' | 'media';
    status: SuggestionStatus;
    reject_reason?: string;
    created_at: string;
    updated_at: string;
}

export interface SuggestedProfileDraft {
    name: string;
    keywords: string[];
    description: string;
    article_count: number;
}

export interface NewsSource {
    last_attempted_at?: string;
    last_provider_success_at?: string;
    next_due_at?: string;
    failure_streak?: number;
    intake_circuit_until?: string;
    id: string;
    name: string;
    type: string;
    category?: 'news' | 'media';
    feed_url?: string;
    image_url?: string;
    is_active: boolean;
    fetch_interval_minutes: number;
    last_fetched_at?: string;
    created_at: string;
    updated_at: string;
    discovery_profile_id?: string;
    items_count: number;
    ready: number;
    failed: number;
    last_item_at?: string;
    engagement: number;
}

export interface DiscoveryConfig {
    automation_enabled: boolean;
    sweep_interval_hours: number;
    min_confidence: number;
    min_relevance: number;
    dup_threshold: number;
    dup_penalty: number;
    recency_window_days: number;
    max_candidates_per_profile: number;
    search_provider: 'auto' | 'tavily' | 'crawl';
    // Source Intelligence Graph
    intelligence_enabled: boolean;
    telegram_discovery_enabled: boolean;
    twitter_discovery_enabled: boolean;
    twitter_recommend_enabled: boolean;
    youtube_discovery_enabled: boolean;
    podcast_discovery_enabled: boolean;
    youtube_related_enabled: boolean;
    apple_related_enabled: boolean;
    media_initial_max_episodes: number;
    graph_build_interval_hours: number;
    promotion_threshold: number;
    weight_citation: number;
    weight_cocitation: number;
    weight_authority: number;
    weight_relevance: number;
    weight_health: number;
    weight_novelty: number;
    created_at?: string;
    updated_at?: string;
}

export interface NetworkAuthority {
    domain: string;
    kind?: string;
    authority: number;
    citation_count: number;
    cocitation_count: number;
    feed_valid: boolean;
    status: string;
}

export interface ListResponse<T> {
    data: T[];
    total?: number;
}

export interface SuggestionsResponse {
    data: SourceSuggestion[];
    total: number;
    page: number;
    limit: number;
}

export interface MediaSourcesContextRollups {
    pending: number;
    imported: number;
    auto_discovered: number;
    active: number;
    healthy: number;
    stale: number;
    never_run: number;
    disabled: number;
    failed: number;
    no_transcript: number;
    needs_trimming: number;
    non_audio_first: number;
}

export type SuggestionRelationshipKind = 'new' | 'duplicate' | 'similar' | 'already_approved' | 'improves_existing';

export interface SuggestionRelationship {
    relationship: SuggestionRelationshipKind;
    matched_source_id?: string;
    matched_source_name?: string;
    reasons: string[];
}

export interface MediaSourceApprovalPreview {
    source_type: string;
    category: 'news' | 'media' | string;
    attached_profile_id?: string;
    attached_profile_name?: string;
    initial_episode_cap: number;
    fetch_interval_minutes: number;
    atomization_defaults: Record<string, unknown>;
    first_fetch: 'queued_on_approve' | string;
}

export type MediaSourceHandoffStatus =
    | 'approved'
    | 'first_fetch_queued'
    | 'waiting_for_items'
    | 'producing'
    | 'needs_attention';

export interface MediaSourceApprovalHandoff {
    suggestion_id: string;
    source_id?: string;
    source_name: string;
    profile_id?: string;
    profile_name?: string;
    status: MediaSourceHandoffStatus;
    approved_at: string;
    items_count: number;
    ready: number;
    failed: number;
}

export interface MediaSourceRecentItem {
    id: string;
    title: string;
    status: string;
    published_at?: string;
    duration_sec?: number;
    caption_state?: string;
    chaptering_status?: string;
    feed_visibility: string;
}

export interface MediaSourcesContext {
    profiles: DiscoveryProfile[];
    suggestions: SourceSuggestion[];
    sources: NewsSource[];
    source_stats: import('./source').SourceStats;
    config: DiscoveryConfig;
    rollups: MediaSourcesContextRollups;
    suggestion_relationships: Record<string, SuggestionRelationship>;
    recent_approvals: MediaSourceApprovalHandoff[];
    approval_preview?: MediaSourceApprovalPreview;
    selected_profile?: DiscoveryProfile;
    selected_suggestion?: SourceSuggestion;
    selected_source?: NewsSource;
    selected_source_recent_items?: MediaSourceRecentItem[];
    schema_status: Record<string, boolean>;
}
