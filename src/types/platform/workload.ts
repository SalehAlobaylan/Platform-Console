export type WorkloadMode = 'off' | 'observe' | 'enforce';
export interface WorkloadResourceLimit {
  soft: number;
  hard: number;
  capacity: number;
}
export interface WorkloadPolicy {
  scope: string;
  revision: number;
  mode: WorkloadMode;
  enforced_classes: string[];
  resource_limits: Record<string, WorkloadResourceLimit>;
  paused_until?: string | null;
  snapshot_max_age_seconds: number;
  recovery_seconds: number;
  lease_seconds: number;
  starvation_minutes: number;
  observation_hours: number;
  min_class_requests: number;
  updated_at: string;
  updated_by: string;
}
export interface WorkloadResource {
  key: string;
  label: string;
  kind: string;
  state: string;
  fresh: boolean;
  available: boolean;
  healthy: boolean;
  observed_at?: string | null;
  pressure: number;
  reserved: number;
  limit: WorkloadResourceLimit;
  reason: string;
}
export interface WorkloadCoverage {
  system: string;
  classes: string[];
  relationship: string;
  boundary: string;
  reason: string;
  requests_24h?: number;
  last_requested_at?: string | null;
  runtime_observed?: boolean;
}
export interface WorkloadClassQualification {
  class: string;
  eligible: boolean;
  requests: number;
  settled: number;
  would_defer: number;
  unavailable: number;
  unresolved: number;
  first_observed_at?: string | null;
  missing: string[];
  callers?: { system: string; requests: number; observed: boolean }[];
  mean_completion_seconds?: number;
}
export interface WorkloadQualification {
  digest: string;
  window_start: string;
  window_end: string;
  required_hours: number;
  required_requests: number;
  classes: WorkloadClassQualification[];
  fresh_resources: number;
  total_resources: number;
  evidence: string[];
  resources?: {
    resource: string;
    samples: number;
    unknown: number;
    saturated: number;
    growth_alarms: number;
    max_pressure: number;
  }[];
  correlation_available?: boolean;
  correlation_reason?: string;
  correlations?: {
    incident_id: string;
    service: string;
    class: string;
    started_at: string;
    resolved_at?: string | null;
    decisions: number;
    would_defer: number;
    href: string;
  }[];
}
export interface WorkloadStatus {
  unavailable_count?: number;
  disabled_journal_loss?: number;
  policy: WorkloadPolicy;
  mode: string;
  effective_mode?: string;
  available: boolean;
  heartbeat_at?: string | null;
  summary: {
    active_permits: number;
    uncertain_permits: number;
    overdue_permits: number;
    decisions_24h: number;
    would_defer_24h: number;
    unavailable_24h: number;
  };
  resources: WorkloadResource[];
  attention: {
    tenant_id: string;
    system: string;
    class: string;
    reason: string;
    since: string;
    count: number;
  }[];
  coverage: WorkloadCoverage[];
  reasons: string[];
}
export interface WorkloadRegistry {
  classes: {
    key: string;
    label: string;
    resources: string[];
    unit_label: string;
  }[];
  resources: { key: string; label: string; kind: string }[];
  coverage: WorkloadCoverage[];
}
export interface WorkloadDecision {
  id: string;
  permit_id?: string;
  tenant_id: string;
  system: string;
  class: string;
  event: string;
  verdict: string;
  would_verdict: string;
  requested_units: number;
  granted_units: number;
  actual_units?: number;
  reasons: string[];
  evidence: Record<string, unknown>;
  mode: string;
  policy_revision: number;
  actor?: string;
  created_at: string;
}
export interface WorkloadPermit {
  id: string;
  tenant_id: string;
  system: string;
  class: string;
  run_id: string;
  origin: string;
  owner_kind: string;
  owner_id: string;
  requested_units: number;
  granted_units: number;
  actual_units?: number;
  state: string;
  mode: string;
  verdict: string;
  would_verdict: string;
  reasons: string[];
  reservations: Record<string, number>;
  bypass: boolean;
  policy_revision: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  began_at?: string | null;
  released_at?: string | null;
  settlement_proof?: string;
  can_revoke: boolean;
}
export interface WorkloadSnapshot {
  id: string;
  resource: string;
  state: string;
  available: boolean;
  healthy: boolean;
  pressure: number;
  reason: string;
  observed_at: string;
  created_at: string;
  recovery_since?: string | null;
  evidence: Record<string, unknown>;
}
export interface WorkloadPage<T> {
  data: T[];
  next_cursor?: string;
}
export interface WorkloadPolicyUpdate {
  revision: number;
  mode: WorkloadMode;
  enforced_classes: string[];
  resource_limits: Record<string, WorkloadResourceLimit>;
  snapshot_max_age_seconds: number;
  recovery_seconds: number;
  lease_seconds: number;
  starvation_minutes: number;
  qualification_digest?: string;
  review_note: string;
  confirmation?: string;
}
export interface WorkloadFilters {
  class?: string;
  system?: string;
  tenant?: string;
  state?: string;
  verdict?: string;
  limit?: number;
  before?: string;
  resource?: string;
}
