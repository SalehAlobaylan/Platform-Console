import { cmsClient } from '@/lib/api/client';

type Envelope<T> = { data: T };
const unwrap = async <T>(request: Promise<Envelope<T>>) => (await request).data;
const BASE = '/admin/ops';
export type OpsState =
  | 'running'
  | 'idle'
  | 'paused'
  | 'disabled'
  | 'unconfigured'
  | 'stalled'
  | 'run_stuck'
  | 'errored'
  | 'unknown'
  | 'attention';
export interface OpsFleetStatus {
  member_key: string;
  member_label: string;
  family: string;
  kind: string;
  lane_key: string;
  lane_label: string;
  tenant_id?: string;
  state: OpsState;
  enabled: boolean;
  pausable: boolean;
  mode?: string;
  paused_until?: string | null;
  last_run_at?: string | null;
  next_due_at?: string | null;
  deep_due_at?: string | null;
  liveness: string;
  cockpit_path: string;
  error?: string;
  last_run_status?: string;
  last_run_headline?: string;
  open_attention_count?: number;
  trust?: { state: string; earned: number; total: number; detail?: string };
  containment?: {
    registered: boolean;
    opted_out: boolean;
    pause_scope?: string;
  };
  evidence?: string;
}
export interface OpsAttentionItem {
  key: string;
  fingerprint: string;
  system: string;
  tenant_id?: string;
  kind: string;
  severity: 'critical' | 'major' | 'minor' | 'info' | string;
  title: string;
  detail: string;
  count: number;
  first_seen: string;
  href: string;
  issue_href?: string;
  state?: string;
  snoozed: boolean;
  snoozed_until?: string | null;
}
export interface OpsStatus {
  as_of: string;
  headline: 'all_clear' | 'watching' | 'attention' | 'incident' | string;
  summary: string;
  fleet: OpsFleetStatus[];
  attention_counts: Record<string, number>;
  attention_kind_counts?: Record<string, number>;
  adapter_errors: string[];
  complete?: boolean;
  pause_targets_readable?: boolean;
  adapter_timings?: { adapter: string; duration_ms: number; error?: string }[];
}
export interface OpsCommand {
  id: string;
  command: string;
  scope: string;
  reason: string;
  ttl_minutes?: number | null;
  source_command_id?: string | null;
  status: string;
  counts: Record<string, number>;
  created_at: string;
  actor_id?: string;
  actor_email?: string;
}
export interface OpsCommandAction {
  id: string;
  member_key: string;
  lane_key: string;
  tenant_id: string;
  prior_paused_until?: string | null;
  written_paused_until?: string | null;
  outcome: string;
  guardrail?: string;
  reason?: string;
  source_action_id?: number;
}
export interface OpsFilters {
  system?: string;
  kind?: string;
  severity?: string;
  state?: string;
  include_snoozed?: boolean;
  include_acked?: boolean;
  offset?: number;
  limit?: number;
}
export interface OpsHandoff {
  episode_id: string;
  owner: string;
  next_step: string;
  next_check?: string;
  revision: number;
  mine: boolean;
}

export const updateOpsHandoff = (body: {
  episode_id: string; fingerprint: string; severity: string; revision: number;
  action: 'claim' | 'update' | 'release'; next_step?: string; next_check?: string;
}) => cmsClient.post('/admin/ops/attention/handoff', body);

export interface OpsAttentionPage {
  handoffs?: OpsHandoff[] | null;
  handoffs_available?: boolean;
  complete?: boolean;
  as_of: string;
  items: OpsAttentionItem[];
  adapter_errors: string[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}
export interface OpsBriefing {
  handoffs?: OpsHandoff[] | null;
  since: string;
  through: string;
  read_token: string;
  commands: OpsCommand[];
  items: {
    key: string;
    system: string;
    family: string;
    kind: string;
    title: string;
    count: number;
    href: string;
    first_seen: string;
    last_seen: string;
  }[];
  totals: Record<string, number>;
  adapter_errors: string[];
  complete: boolean;
}
export interface OpsCalendar {
  as_of: string;
  fleet: OpsFleetStatus[];
  complete: boolean;
  adapter_errors: string[];
  runs: {
    key: string;
    system: string;
    lane_key: string;
    tenant_id?: string;
    started_at: string;
    finished_at?: string | null;
    status: string;
    duration_ms: number;
    href: string;
  }[];
  events: {
    key: string;
    system: string;
    at?: string;
    count?: number;
    kind?: string;
    started_at?: string;
    created_at?: string;
    status?: string;
    verdict?: string;
    href?: string;
  }[];
  overlaps: {
    started_at: string;
    finished_at: string;
    systems: string[];
    run_keys: string[];
  }[];
  truncated?: boolean;
}
export interface OpsCommandScope {
  command: 'pause_all' | 'pause_member' | 'resume';
  member_key?: string;
  lane_key?: string;
  tenant_id?: string;
  source_command_id?: string;
}
export interface OpsCommandPreview {
  snapshot_at: string;
  target_digest: string;
  expires_at: string;
  target_count: number;
  scope: OpsCommandScope;
  excluded: string[];
  targets: {
    member_key: string;
    lane_key: string;
    tenant_id: string;
    state: string;
    exists: boolean;
    prior_paused_until?: string | null;
  }[];
}
export type OpsCommandRequest = OpsCommandScope & {
  snapshot_at: string;
  target_digest: string;
  idempotency_key: string;
  reason?: string;
  ttl_minutes?: number;
};
export const getOpsStatus = (signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<Envelope<OpsStatus>>(`${BASE}/status`, undefined, signal)
  );
export const getOpsFleet = (signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<Envelope<{ items: OpsFleetStatus[]; members?: unknown[] }>>(
      `${BASE}/fleet`,
      undefined,
      signal
    )
  );
export const getOpsAttention = (filters?: OpsFilters, signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<Envelope<OpsAttentionPage>>(
      `${BASE}/attention`,
      filters,
      signal
    )
  );
export const getOpsBriefing = (signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<Envelope<OpsBriefing>>(`${BASE}/briefing`, undefined, signal)
  );
export const getOpsCalendar = (signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<Envelope<OpsCalendar>>(`${BASE}/calendar`, undefined, signal)
  );
export const listOpsCommands = (offset = 0, signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<
      Envelope<{ items: OpsCommand[]; has_more?: boolean; total?: number }>
    >(`${BASE}/commands`, { offset, limit: 20 }, signal)
  );
export const getOpsCommand = (id: string, signal?: AbortSignal) =>
  unwrap(
    cmsClient.get<
      Envelope<{ command: OpsCommand; actions: OpsCommandAction[] }>
    >(`${BASE}/commands/${encodeURIComponent(id)}`, undefined, signal)
  );
export type OpsAttentionReview = Pick<
  OpsAttentionItem,
  'key' | 'fingerprint' | 'severity' | 'count'
>;
export const ackOpsAttention = (review: OpsAttentionReview) =>
  unwrap(cmsClient.post<Envelope<unknown>>(`${BASE}/attention/ack`, review));
export const snoozeOpsAttention = (
  review: OpsAttentionReview,
  ttl_minutes: number
) =>
  unwrap(
    cmsClient.post<Envelope<unknown>>(`${BASE}/attention/snooze`, {
      ...review,
      ttl_minutes,
    })
  );
export const clearOpsAttention = async (key: string) => {
  await cmsClient.post<void>(`${BASE}/attention/clear`, { key });
};
export const markOpsBriefingSeen = (
  since: string,
  through: string,
  read_token: string
) =>
  unwrap(
    cmsClient.post<Envelope<unknown>>(`${BASE}/briefing/seen`, {
      since,
      through,
      read_token,
    })
  );
export const previewOpsCommand = (
  scope: OpsCommandScope,
  signal?: AbortSignal
) =>
  unwrap(
    cmsClient.post<Envelope<OpsCommandPreview>>(
      `${BASE}/commands/preview`,
      scope,
      { signal }
    )
  );
export function executeOpsCommand(request: OpsCommandRequest) {
  const route =
    request.command === 'pause_all'
      ? 'pause-all'
      : request.command === 'pause_member'
        ? 'pause-member'
        : 'resume';
  return unwrap(
    cmsClient.post<Envelope<OpsCommand>>(`${BASE}/commands/${route}`, request)
  );
}
