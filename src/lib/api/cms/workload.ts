import { z } from 'zod';
import { cmsClient } from '@/lib/api/client';
import type {
  WorkloadDecision,
  WorkloadFilters,
  WorkloadPage,
  WorkloadPermit,
  WorkloadPolicy,
  WorkloadPolicyUpdate,
  WorkloadQualification,
  WorkloadRegistry,
  WorkloadSnapshot,
  WorkloadStatus,
} from '@/types/platform/workload';

const BASE = '/admin/workload';
const text = z.string();
const count = z.number().int().nonnegative();
const finite = z.number().finite();
const timestamp = z
  .string()
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    'Invalid observation timestamp'
  );
const optionalTime = timestamp.nullish();
const strings = z
  .array(text)
  .nullable()
  .transform((value) => value || []);
const mode = z.enum(['off', 'observe', 'enforce']);
const limit = z.object({ soft: finite, hard: finite, capacity: count });
const policy = z.object({
  scope: text,
  revision: count,
  mode,
  enforced_classes: strings,
  resource_limits: z.record(limit),
  paused_until: optionalTime,
  snapshot_max_age_seconds: count,
  recovery_seconds: count,
  lease_seconds: count,
  starvation_minutes: count,
  observation_hours: count,
  min_class_requests: count,
  updated_at: timestamp,
  updated_by: text,
});
const coverage = z.object({
  system: text,
  classes: strings,
  relationship: text,
  boundary: text,
  reason: text,
  requests_24h: count.optional(),
  last_requested_at: optionalTime,
  runtime_observed: z.boolean().optional(),
});
const resource = z.object({
  key: text,
  label: text,
  kind: text,
  state: text,
  fresh: z.boolean(),
  available: z.boolean(),
  healthy: z.boolean(),
  observed_at: optionalTime,
  pressure: finite,
  reserved: count,
  limit,
  reason: text,
});
const status = z.object({
  unavailable_count: count.optional(),
  disabled_journal_loss: count.optional(),
  policy,
  mode: text,
  effective_mode: text.optional(),
  available: z.boolean(),
  heartbeat_at: optionalTime,
  resources: z
    .array(resource)
    .nullable()
    .transform((v) => v || []),
  summary: z.object({
    active_permits: count,
    uncertain_permits: count,
    overdue_permits: count,
    decisions_24h: count,
    would_defer_24h: count,
    unavailable_24h: count,
  }),
  attention: z
    .array(
      z.object({
        tenant_id: text,
        system: text,
        class: text,
        reason: text,
        since: timestamp,
        count,
      })
    )
    .nullable()
    .transform((v) => v || []),
  coverage: z
    .array(coverage)
    .nullable()
    .transform((v) => v || []),
  reasons: strings,
});
const correlation = z.object({
  incident_id: text,
  service: text,
  class: text,
  started_at: timestamp,
  resolved_at: optionalTime,
  decisions: count,
  would_defer: count,
  href: text.refine((value) =>
    /^\/platform\/system-health(?:\?|$)/.test(value)
  ),
});
const qualification = z.object({
  digest: text,
  correlation_available: z.boolean().optional(),
  correlation_reason: text.optional(),
  correlations: z
    .array(correlation)
    .nullish()
    .transform((v) => v || []),
  window_start: timestamp,
  window_end: timestamp,
  required_hours: count,
  required_requests: count,
  classes: z
    .array(
      z.object({
        class: text,
        eligible: z.boolean(),
        requests: count,
        settled: count,
        would_defer: count,
        unavailable: count,
        unresolved: count,
        first_observed_at: optionalTime,
        missing: strings,
        callers: z
          .array(
            z.object({ system: text, requests: count, observed: z.boolean() })
          )
          .nullish()
          .transform((v) => v || []),
        mean_completion_seconds: finite.optional(),
      })
    )
    .nullable()
    .transform((v) => v || []),
  fresh_resources: count,
  total_resources: count,
  evidence: strings,
  resources: z
    .array(
      z.object({
        resource: text,
        samples: count,
        unknown: count,
        saturated: count,
        growth_alarms: count,
        max_pressure: finite,
      })
    )
    .nullish()
    .transform((v) => v || []),
});
const registry = z.object({
  classes: z.array(
    z.object({ key: text, label: text, resources: strings, unit_label: text })
  ),
  resources: z.array(z.object({ key: text, label: text, kind: text })),
  coverage: z.array(coverage),
});
const id = z
  .union([z.string().min(1), z.number().int().nonnegative().safe()])
  .transform(String);
const evidence = z
  .record(z.unknown())
  .nullable()
  .transform((v) => v || {});
const decision = z.object({
  id,
  permit_id: text.optional(),
  tenant_id: text,
  system: text,
  class: text,
  event: text,
  verdict: text,
  would_verdict: text,
  requested_units: count,
  granted_units: count,
  actual_units: count.optional(),
  reasons: strings,
  evidence,
  mode: text,
  policy_revision: count,
  actor: text.optional(),
  created_at: timestamp,
});
const permit = z.object({
  id,
  tenant_id: text,
  system: text,
  class: text,
  run_id: text,
  origin: text,
  owner_kind: text,
  owner_id: text,
  requested_units: count,
  granted_units: count,
  actual_units: count.optional(),
  state: text,
  mode: text,
  verdict: text,
  would_verdict: text,
  reasons: strings,
  reservations: z
    .record(count)
    .nullable()
    .transform((v) => v || {}),
  bypass: z.boolean(),
  policy_revision: count,
  created_at: timestamp,
  updated_at: timestamp,
  expires_at: timestamp,
  began_at: optionalTime,
  released_at: optionalTime,
  settlement_proof: text.optional(),
  can_revoke: z.boolean(),
});
const snapshot = z.object({
  id,
  resource: text,
  state: text,
  available: z.boolean(),
  healthy: z.boolean(),
  pressure: finite,
  reason: text,
  observed_at: timestamp,
  created_at: timestamp,
  recovery_since: optionalTime,
  evidence,
});

function parse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      'Workload evidence is incomplete or incompatible. Refresh after checking the CMS service.'
    );
  return result.data;
}
async function get<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const result = await cmsClient.get<unknown>(
    `${BASE}/${path}`,
    undefined,
    signal
  );
  const envelope = parse(z.object({ data: z.unknown() }), result);
  return parse(schema, envelope.data);
}
async function list<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  filters: WorkloadFilters,
  signal?: AbortSignal
): Promise<WorkloadPage<T>> {
  const result = await cmsClient.get<unknown>(
    `${BASE}/${path}`,
    filters,
    signal
  );
  return parse(
    z.object({ data: z.array(schema), next_cursor: text.optional() }),
    result
  );
}
export const getWorkloadStatus = (
  signal?: AbortSignal
): Promise<WorkloadStatus> => get('status', status, signal);
export const getWorkloadPolicy = (
  signal?: AbortSignal
): Promise<WorkloadPolicy> => get('policy', policy, signal);
export const getWorkloadRegistry = (
  signal?: AbortSignal
): Promise<WorkloadRegistry> => get('registry', registry, signal);
export const getWorkloadQualification = (
  signal?: AbortSignal
): Promise<WorkloadQualification> =>
  get('qualification', qualification, signal);
export const listWorkloadDecisions = (
  filters: WorkloadFilters = {},
  signal?: AbortSignal
): Promise<WorkloadPage<WorkloadDecision>> =>
  list('decisions', decision, filters, signal);
export const listWorkloadPermits = (
  filters: WorkloadFilters = {},
  signal?: AbortSignal
): Promise<WorkloadPage<WorkloadPermit>> =>
  list('permits', permit, filters, signal);
export const listWorkloadSnapshots = (
  filters: WorkloadFilters = {},
  signal?: AbortSignal
): Promise<WorkloadPage<WorkloadSnapshot>> =>
  list('snapshots', snapshot, filters, signal);
export async function updateWorkloadPolicy(
  input: WorkloadPolicyUpdate
): Promise<WorkloadPolicy> {
  return parse(
    z.object({ data: policy }),
    await cmsClient.put<unknown>(`${BASE}/policy`, input)
  ).data;
}
export async function pauseWorkload(input: {
  revision: number;
  minutes: number;
  reason: string;
}): Promise<WorkloadPolicy> {
  return parse(
    z.object({ data: policy }),
    await cmsClient.post<unknown>(`${BASE}/pause`, input)
  ).data;
}
export async function revokeWorkloadPermit(input: {
  id: string;
  reason: string;
}): Promise<void> {
  await cmsClient.post(
    `${BASE}/permits/${encodeURIComponent(input.id)}/revoke`,
    { reason: input.reason }
  );
}
