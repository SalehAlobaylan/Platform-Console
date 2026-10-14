export type ExperienceClient = 'web' | 'ios' | 'android';
// Real User Experience (RUX) — Console types mirroring the CMS admin surface.

export type RuxVerdict =
  | 'healthy'
  | 'watching'
  | 'degraded'
  | 'critical'
  | 'insufficient_data'
  | 'telemetry_degraded';

export type RuxIncidentStatus =
  | 'confirming'
  | 'open'
  | 'recovering'
  | 'resolved'
  | 'closed';
export type RuxSeverity = 'watching' | 'degraded' | 'critical';

export interface ExperiencePolicy {
  enabled_clients?: string;
  tenant_id: string;
  ingest_enabled: boolean;
  evaluation_enabled: boolean;
  enabled_surfaces: string;
  min_sample_floor: number;
  latency_sample_floor: number;
  minute_rollup_retention_hours: number;
  hour_rollup_retention_days: number;
  last_minute_bucket?: string | null;
  thresholds?: Record<string, { target?: number; latency_p75_ms?: number }>;
  confirm_windows: number;
  resolve_windows: number;
  telemetry_freshness_minutes: number;
  raw_retention_days: number;
  max_release_cohorts: number;
  paused_until: string | null;
  last_evaluated_bucket: string | null;
  updated_at: string;
}

export interface ExperienceRun {
  id: string;
  trigger: string;
  status: 'running' | 'completed' | 'partial' | 'failed';
  telemetry_fresh: boolean;
  surface_verdicts: Record<string, SurfaceVerdict> | null;
  summary: string;
  buckets_processed: number;
  started_at: string;
  finished_at: string | null;
  error: string;
  error_class: string;
}

export interface SliStatus {
  metric: string;
  label: string;
  value: number;
  target: number;
  numerator: number;
  denominator: number;
  population: string;
  latency_samples: number;
  active_sessions: number;
  affected_sessions: number;
  required: boolean;
  confirmed: boolean;
  p75_ms?: number;
  p75_budget_ms?: number;
  evidence_reason?: string;
  status: 'ok' | 'breach' | 'latency_breach' | 'insufficient' | 'not_exercised';
  critical: boolean;
  likely_owner?: string;
}

export interface SurfaceVerdict {
  verdict: RuxVerdict;
  slis: SliStatus[];
}

export interface ExperienceMetrics {
  client_platform?: ExperienceClient;
  observed_scope?: ExperienceClient;
  client_enabled?: boolean;
  bucket: string;
  telemetry_fresh: boolean;
  surfaces: Record<string, SurfaceVerdict>;
}

export interface ExperienceIncident {
  client_platform?: ExperienceClient;
  id: string;
  fingerprint: string;
  metric_key: string;
  surface: string;
  cohort_dim: string;
  cohort_val: string;
  severity: RuxSeverity;
  status: RuxIncidentStatus;
  summary: string;
  evidence: Record<string, unknown> | null;
  recommendation: string;
  likely_owner: string;
  violation_streak: number;
  clean_streak: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  confirmed_at?: string | null;
  recovering_since?: string | null;
  investigation_path?: string;
  last_evaluated_bucket?: string | null;
  close_reason_class?: string;
}

export interface ExperienceAction {
  id: string;
  action_class: string;
  label: string;
  metric_key: string;
  surface: string;
  guardrail: string;
  created_at: string;
}

export interface ExperienceSuppression {
  client_platform?: ExperienceClient;
  id: string;
  metric_key: string;
  surface: string;
  cohort_dim: string;
  cohort_val: string;
  reason: string;
  starts_at: string;
  expires_at: string;
  created_by: string;
}

export interface ExperienceStatus {
  policy: ExperiencePolicy;
  latest_run: ExperienceRun | null;
  telemetry_fresh: boolean;
  open_incidents: number;
  surface_verdicts: Record<string, SurfaceVerdict> | null;
}

export type IncidentCloseReason =
  | 'resolved_externally'
  | 'expected_behavior'
  | 'false_positive'
  | 'accepted_risk';

export interface ExperienceRollup {
  client_platform?: ExperienceClient;
  bucket_start: string;
  resolution: string;
  metric_key: string;
  surface: string;
  cohort_dim: string;
  cohort_val: string;
  numerator: number;
  denominator: number;
  sample_count: number;
  outcome_count: number;
  active_sessions: number;
  affected_sessions: number;
  histogram_version: number;
}
export interface ExperienceEventEvidence {
  event_id: string;
  event_type: string;
  surface: string;
  release: string;
  journey_id?: string;
  occurred_at: string;
  received_at: string;
  phase?: string;
  outcome?: string;
  terminal_status?: string;
  measurements?: Record<string, unknown>;
}
export interface ExperienceContentFailure {
  content_id: string;
  failures: number;
  affected_sessions: number;
}

export interface ExperienceEvidencePage<T> {
  rows: T[];
  next_before_id?: number;
  minimum_denominator?: number;
  resolution?: string;
  window_start?: string;
  window_end?: string;
  release_comparison?: ExperienceReleaseComparison | null;
}

export interface ExperienceReleaseComparison {
  current_release?: string;
  previous_release?: string;
  qualified: boolean;
  reason: string;
  metrics: {
    surface: string;
    metric: string;
    comparable_windows: number;
    current_numerator: number;
    current_denominator: number;
    previous_numerator: number;
    previous_denominator: number;
    current_p75_ms?: number;
    previous_p75_ms?: number;
    latency_qualified: boolean;
  }[];
}
