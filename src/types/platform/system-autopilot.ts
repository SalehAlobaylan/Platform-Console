import type { ServiceName } from '@/types/platform/system-health';

export type SystemAutopilotMode = 'observe' | 'safe_auto';
export type SystemAutopilotState = 'off' | 'observe' | 'safe_auto' | 'paused';
export type SystemAutopilotRunStatus =
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';

export interface SystemAutopilotPolicy {
  scope: 'platform';
  enabled: boolean;
  mode: SystemAutopilotMode;
  interval_minutes: number;
  confirm_probes: number;
  resolve_probes: number;
  flap_cycles_24h: number;
  containment_ttl_minutes: number;
  containment_disabled_for?: string[];
  containment_paused_until?: string | null;
  last_run_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SystemIncidentEpisode {
  id: string;
  root_service: ServiceName | 'platform';
  verdict: string;
  status: 'open' | 'recovering' | 'resolved' | 'closed_by_human';
  severity: 'critical' | 'warning' | string;
  shadow?: boolean;
  summary: string;
  root_cause_hint?: string;
  evidence?: unknown;
  timeline?: SystemIncidentTimelineEntry[];
  containment?: SystemContainmentLedger | Record<string, string>;
  first_detected_at: string;
  last_seen_at: string;
  recovering_since?: string | null;
  resolved_at?: string | null;
  closed_by?: string;
  close_reason?: string;
}

export interface SystemContainmentLedgerEntry {
  written_until?: string;
  outcome: 'paused' | 'resumed' | 'skipped' | string;
  reason?: string;
  human_owned?: boolean;
}

export interface SystemContainmentLedger {
  version: 2;
  siblings: Record<string, Record<string, SystemContainmentLedgerEntry>>;
}

export interface SystemRecommendedAction {
  label: string;
  kind: string;
  target: string;
  href: string;
}

export interface SystemIncidentTimelineEntry {
  transition: string;
  at: string;
  service: string;
  verdict: string;
  severity?: string;
  summary?: string;
  overall?: string;
  issues?: Array<{ severity: string; service?: string; message: string }>;
}

export interface SystemAutopilotRun {
  id: string;
  trigger: string;
  mode: SystemAutopilotMode;
  status: SystemAutopilotRunStatus;
  headline:
    | 'all_clear'
    | 'watching'
    | 'incident_open'
    | 'contained'
    | 'recovering'
    | string;
  started_at: string;
  finished_at?: string | null;
  summary?: string;
  probe_results?: unknown;
  created_by?: string;
  error?: string;
  error_class?: string;
}

export interface SystemAutopilotAction {
  id: string;
  target: string;
  action: string;
  verdict?: string;
  status: string;
  guardrail?: string;
  reason?: string;
  output?: unknown;
  started_at: string;
  finished_at?: string | null;
}

export interface RegisteredSystemAutopilot {
  id: string;
  key: string;
  label: string;
  dependencies: string[];
  capabilities?: string[];
  containment_enabled: boolean;
}

export type SystemMonitorState =
  | 'disabled'
  | 'never_observed'
  | 'running'
  | 'fresh'
  | 'overdue'
  | 'unavailable'
  | string;

export interface SystemMonitorProjection {
  state: SystemMonitorState;
  fresh: boolean;
  last_observed_at?: string | null;
  last_completed_at?: string | null;
  next_due_at?: string | null;
  evidence_age_seconds?: number | null;
  reason?: string;
}

export interface SystemContainmentTargetProjection {
  episode_id: string;
  sibling: string;
  tenant_id: string;
  outcome: string;
  until?: string;
  human_owned?: boolean;
  reason?: string;
}

export interface SystemContainmentProjection {
  active: number;
  pending: number;
  human_owned: number;
  expired: number;
  targets: SystemContainmentTargetProjection[];
}

export interface SystemAttentionProjection {
  episode_id?: string;
  tenant_id?: string;
  target: string;
  guardrail?: string;
  status: string;
  reason?: string;
  at: string;
}

export interface SystemAutopilotStatus {
  policy: SystemAutopilotPolicy;
  state: SystemAutopilotState;
  latest_run?: SystemAutopilotRun | null;
  open_episodes: SystemIncidentEpisode[];
  recent_episodes?: SystemIncidentEpisode[];
  registered_autopilots: RegisteredSystemAutopilot[];
  monitor?: SystemMonitorProjection;
  containment?: SystemContainmentProjection;
  attention?: SystemAttentionProjection[];
  status_version?: string;
}

export interface SystemAutopilotRunDetail {
  run: SystemAutopilotRun;
  actions: SystemAutopilotAction[];
}

export interface SystemIncidentEpisodeDetail {
  episode: SystemIncidentEpisode;
  actions: SystemAutopilotAction[];
  recommended_action: SystemRecommendedAction;
  containment?: SystemContainmentProjection;
  recovery?: {
    healthy_samples: number;
    required_samples: number;
    evidence_fresh: boolean;
    next_check_at?: string | null;
    reason: string;
  };
}
