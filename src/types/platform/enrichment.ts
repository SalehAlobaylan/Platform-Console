// ── Enrichment Dashboard Types ──────────────────────────────

export interface EnrichmentStats {
  total_media: number;
  with_transcript: number;
  missing_transcript: number;
  with_embedding: number;
  missing_embedding: number;
  // Sparse (BGE-M3 lexical) vectors — populated for long-form alongside dense.
  with_sparse: number;
  missing_sparse: number;
  // CLIP image embeddings — for items that have a thumbnail.
  with_image_embedding: number;
  missing_image_embedding: number;
  total_ready: number;
}

export interface MissingEnrichmentItem {
  id: string;
  title: string;
  type: string;
  source_name: string;
  status: string;
  has_transcript: boolean;
  has_embedding: boolean;
  has_sparse: boolean;
  has_image_embedding: boolean;
  media_url: string;
  thumbnail_url: string;
  created_at: string;
}

/** Artifact a "missing" panel manages + triggers. */
export type EnrichmentArtifact =
  | 'transcript'
  | 'embedding'
  | 'sparse'
  | 'image';

/** Response from POST /admin/enrichment/trigger-all. */
export interface TriggerAllResponse {
  started: boolean;
  total: number;
}

/** Live status of the single background bulk-enrichment run (GET /bulk-status). */
export interface BulkEnrichStatus {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  types: string[];
  content_type?: string;
  last_error?: string;
  started_at?: string;
  finished_at?: string;
}

export interface MissingEnrichmentsResponse {
  items: MissingEnrichmentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MissingEnrichmentCounts {
  transcript: number;
  embedding: number;
  sparse: number;
  image: number;
  transcript_image: number;
  embedding_sparse: number;
}

export interface MissingEnrichmentsParams {
  missing?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Per-service health view. Same shape returned by both Media-Service and
 * Enrichment-Service /ready endpoints, plus an `error` slot when CMS could
 * not reach the service at all.
 */
export interface AIServiceHealth {
  status: string;
  error?: string;
  models?: Record<string, boolean>;
  dependencies?: Record<string, boolean>;
  storage?: {
    configured: boolean;
    authenticated: boolean;
    ready: boolean;
    evidence_fresh: boolean;
    failure_class?: string | null;
  };
}

export interface EnrichmentHealthResponse {
  /** Aggregate status across both AI services: "ok" only when both are ok. */
  status: string;
  /** Legacy fields surface the Enrichment-Service view (text embedder). */
  error?: string;
  models?: Record<string, boolean>;
  dependencies?: Record<string, boolean>;
  /**
   * Per-service breakdown — added after the Media-Service split. Optional
   * so older CMS builds (single Enrichment-Service) still parse cleanly.
   */
  services?: {
    media?: AIServiceHealth;
    enrichment?: AIServiceHealth;
  };
}

export interface TriggerEnrichmentRequest {
  types: string[];
}

export interface TriggerBatchRequest {
  content_ids: string[];
  types: string[];
}

export interface TriggerResultItem {
  content_id: string;
  status: string;
  error?: string;
}

export interface TriggerEnrichmentResponse {
  content_id: string;
  results: string[];
  errors: string[];
}

// ── Enrichment Coverage Autopilot ───────────────────────────

export type EnrichmentAutopilotMode = 'observe' | 'safe_auto';
export type EnrichmentAutopilotState =
  | 'off'
  | 'observe'
  | 'safe_auto'
  | 'elevated'
  | 'paused';
export type EnrichmentAutopilotElevatedMode = 'backfill_catchup' | '';

export interface EnrichmentAutopilotPolicy {
  tenant_id: string;
  enabled: boolean;
  mode: EnrichmentAutopilotMode;
  interval_minutes: number;
  max_items_per_run: number;
  max_items_per_class: number;
  max_transcripts_per_run: number;
  max_queue_depth: number;
  failure_breaker_pct: number;
  stall_window_runs: number;
  age_floor_minutes: number;
  trust_min_attempts: number;
  trust_max_failure_pct: number;
  paused_until?: string | null;
  elevated_mode?: string;
  elevated_until?: string | null;
  last_run_at?: string | null;
}

export interface EnrichmentTrustStat {
  artifact: string;
  attempts: number;
  failures: number;
  failure_pct: number;
  state: 'trusted' | 'probation' | 'demoted';
  earned: boolean;
}

export interface EnrichmentAttentionItem {
  kind: 'stuck_class' | 'budget_capped' | 'demoted_class';
  artifact?: string;
  message: string;
  target:
    | 'missing_panel'
    | 'media_studio'
    | 'pipeline'
    | 'transcription_config';
}

export interface EnrichmentAutopilotRun {
  id: string;
  tenant_id: string;
  trigger: string;
  mode: string;
  elevated_mode?: string;
  status: 'running' | 'completed' | 'partial' | 'failed';
  headline?: 'fully_enriched' | 'backlog' | 'budget_capped' | 'degraded';
  started_at: string;
  finished_at?: string;
  summary?: string;
  stats_before?: EnrichmentStats;
  stats_after?: EnrichmentStats;
  created_by?: string;
  error?: string;
}

export interface EnrichmentAutopilotAction {
  id: string;
  content_id?: string;
  artifact: string;
  status:
    | 'admitted'
    | 'success'
    | 'error'
    | 'skipped'
    | 'approval_required'
    | 'would_trigger'
    | 'would_skip';
  reason?: string;
  guardrail?: string;
  transcription_job_id?: string;
  duration_ms: number;
  started_at: string;
  finished_at?: string;
}

export interface EnrichmentAutopilotStatus {
  enabled: boolean;
  mode: EnrichmentAutopilotMode;
  state: EnrichmentAutopilotState;
  interval_minutes: number;
  elevated_mode?: string;
  elevated_until?: string | null;
  paused_until?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  last_run?: EnrichmentAutopilotRun;
  trust: EnrichmentTrustStat[];
  attention?: EnrichmentAttentionItem[];
  recommended_action?: string;
  policy: EnrichmentAutopilotPolicy;
}

export interface EnrichmentAutopilotRunDetail {
  run: EnrichmentAutopilotRun;
  actions: EnrichmentAutopilotAction[];
}
