import { z } from 'zod';
const profile = z
  .object({
    id: z.string(),
    purpose: z.string(),
    preservation: z.enum(['preserve', 'disposable']),
    cms_database_id: z.string(),
    iam_database_id: z.string(),
    sharing: z.record(z.string()).optional(),
  })
  .strict();
const selection = z
  .object({
    schema_version: z.literal(1),
    revision: z.number().int(),
    default_environment: z.string(),
    next_environment: z.string().optional(),
    updated_at: z.string(),
    updated_by: z.string(),
  })
  .strict();
const migration = z
  .object({
    owner: z.string(),
    file: z.string(),
    checksum: z.string(),
    class: z.string(),
    effects: z.string(),
    requires_destructive_flag: z.boolean(),
  })
  .strict();
const identity = z
  .object({
    id: z.string(),
    epoch: z.number(),
    fence: z.string(),
    fence_epoch: z.number(),
    owner_state: z.string(),
  })
  .strict();
const migrationWork = z
  .object({
    state: z.enum(['ready', 'blocked', 'unknown']),
    schema_upgrade_ready: z.boolean().optional(),
    blocked_by: z
      .object({
        reason: z.enum([
          'migration_not_reviewed',
          'owner_reconciliation_required',
          'live_work',
        ]),
        migration: z
          .string()
          .regex(/^\d{14}_[A-Za-z0-9_-]+\.sql$/)
          .optional(),
        subject: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    attempt_repair: z
      .object({
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        actions: z
          .array(
            z
              .object({
                tenant_id: z.string().min(1),
                attempt_id: z.string().uuid(),
                request_id: z.string().uuid(),
                kind: z.enum(['persisted', 'no_effect']),
                evidence: z.string().min(1),
              })
              .strict()
          )
          .max(1000),
        remaining: z.number().int().nonnegative(),
        reasons: z.record(z.number().int().nonnegative()),
      })
      .strict()
      .optional(),
    count: z.number().int().nonnegative(),
    checks: z.array(
      z
        .object({
          subject: z.string().min(1),
          count: z.number().int().nonnegative(),
          expired: z.number().int().nonnegative().optional(),
          terminal_requests: z.number().int().nonnegative().optional(),
        })
        .strict()
    ),
  })
  .strict()
  .superRefine((work, context) => {
    const total = work.checks.reduce((sum, check) => sum + check.count, 0);
    const blocker = work.blocked_by;
    const positiveSubject = work.checks.some(
      (check) => check.subject === blocker?.subject && check.count > 0
    );
    const repair = work.attempt_repair;
    const attempts =
      work.checks.find((check) => check.subject === 'content_stage_attempts')
        ?.count ?? 0;
    if (
      (blocker &&
        (work.state !== 'blocked' ||
          work.schema_upgrade_ready ||
          (blocker.reason === 'migration_not_reviewed' && !blocker.migration) ||
          (blocker.subject && !positiveSubject) ||
          (blocker.reason !== 'migration_not_reviewed' && !positiveSubject) ||
          (blocker.reason === 'live_work' &&
            ![
              'lifecycle_operation_claims',
              'pipeline_stage_leases',
              'content_stage_attempts',
              'pipeline_repair_requests',
            ].includes(blocker.subject ?? '')))) ||
      total !== work.count ||
      (work.state === 'ready' && total !== 0) ||
      (work.state === 'blocked' && total === 0) ||
      (work.state === 'unknown' && work.checks.length !== 0) ||
      (work.schema_upgrade_ready &&
        (work.state !== 'blocked' ||
          work.checks.some(
            (check) =>
              check.count > 0 &&
              (!['content_stage_attempts', 'pipeline_repair_requests'].includes(
                check.subject
              ) ||
                (check.subject === 'content_stage_attempts' &&
                  check.expired !== check.count))
          ))) ||
      new Set(work.checks.map((check) => check.subject)).size !==
        work.checks.length ||
      work.checks.some(
        (check) =>
          (check.expired ?? 0) > check.count ||
          (check.terminal_requests ?? 0) > check.count
      ) ||
      (repair &&
        (repair.actions.length + repair.remaining !== attempts ||
          Object.values(repair.reasons).reduce(
            (sum, count) => sum + count,
            0
          ) !== repair.remaining ||
          new Set(repair.actions.map((action) => action.attempt_id)).size !==
            repair.actions.length))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inconsistent migration work evidence',
      });
    }
  });
const health = z
  .object({
    owner: z.string(),
    target: z.string(),
    state: z.string(),
    ledger: z.string(),
    identity,
    pending: z.array(migration),
    // Older saved Go reports encode an empty issue slice as null. Normalize
    // only that representation; malformed or missing evidence still fails.
    issues: z
      .array(z.string())
      .nullable()
      .transform((issues) => issues ?? []),
    warnings: z.array(z.string()).optional(),
    legacy_checksum_history: z.array(z.string()).optional(),
    missing: z.array(z.string()),
    schema_digest: z.string(),
    repair: z.record(z.unknown()).optional(),
    checksum_repair: z.record(z.unknown()).optional(),
    migration_work: migrationWork.optional(),
    dirty: z.boolean(),
    version: z.number(),
    empty: z.boolean(),
  })
  .strict();
export const reportSchema = z
  .object({
    id: z.string(),
    environment: z.string(),
    config_revision: z.string(),
    observed_at: z.string(),
    state: z.string(),
    databases: z.array(health),
    resources: z.array(
      z
        .object({
          resource: z.string(),
          target: z.string(),
          state: z.string(),
          detail: z.string(),
        })
        .strict()
    ),
    build_digest: z.string(),
    digest: z.string(),
  })
  .strict();
const runtime = z
  .object({
    id: z.string(),
    environment: z.string(),
    config_revision: z.string(),
    selection_revision: z.number(),
    override: z.boolean(),
    smoke: z.boolean(),
    state: z.string(),
    pid: z.number(),
    process_start: z.string(),
    owner_token: z.string(),
    started_at: z.string(),
    updated_at: z.string(),
    log_directory: z.string(),
    reason: z.string().optional(),
    report_id: z.string().optional(),
    builds: z.record(z.string()),
    process_groups: z.array(z.number()),
  })
  .strict();
export const upgradeJobSchema = z
  .object({
    id: z.string().uuid(),
    environment: z.string(),
    runtime_id: z.string().uuid(),
    plan_id: z.string().uuid(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    actor: z.string(),
    state: z.enum([
      'queued',
      'building',
      'pausing',
      'applying',
      'verifying',
      'restarting',
      'succeeded',
      'needs_attention',
      'interrupted',
    ]),
    created_at: z.string(),
    updated_at: z.string(),
    messages: z
      .array(z.object({ at: z.string(), text: z.string() }).strict())
      .max(101),
  })
  .strict();
export const overviewSchema = z
  .object({
    profiles: z.array(profile),
    selection,
    runtime: runtime.nullable(),
    last_successful: runtime.nullable(),
    reports: z.record(reportSchema.nullable()),
    upgrades: z.record(upgradeJobSchema.nullable()).optional(),
    configuration: z
      .record(
        z
          .object({
            state: z.enum(['configured', 'not_configured']),
            detail: z.string(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();
export const planSchema = z
  .object({
    mode: z.literal('upgrade').optional(),
    id: z.string(),
    environment: z.string(),
    report: reportSchema,
    steps: z.array(
      z
        .object({
          owner: z.string(),
          kind: z.string(),
          migration: migration.optional(),
          digest: z.string().optional(),
          new_identity: z.string().optional(),
          summary: z.string(),
        })
        .strict()
    ),
    blocked: z.array(z.string()),
    expires_at: z.string(),
    digest: z.string(),
    recovery_point: z.string().optional(),
  })
  .strict();
const eventSchema = z
  .object({
    id: z.string(),
    environment: z.string(),
    kind: z.string(),
    actor: z.string(),
    at: z.string(),
    detail: z.unknown().optional(),
  })
  .strict();
export type EnvironmentOverview = z.infer<typeof overviewSchema>;
export type EnvironmentReport = z.infer<typeof reportSchema>;
export type PreparationPlan = z.infer<typeof planSchema>;
export type EnvironmentEvent = z.infer<typeof eventSchema>;
export type UpgradeJob = z.infer<typeof upgradeJobSchema>;
async function request<T>(
  action: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  body?: object
): Promise<T> {
  const response = await fetch(`/api/local-environments/${action}`, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined')
      window.location.assign('/login');
    throw new Error(
      typeof value === 'object' && value !== null && 'message' in value
        ? String(value.message)
        : 'Environment request failed'
    );
  }
  return schema.parse(value);
}
export const localEnvironmentAPI = {
  overview: () => request('overview', overviewSchema),
  inspect: (environment: string) =>
    request('inspect', reportSchema, { environment }),
  select: (environment: string, revision: number) =>
    request('selection', selection, { environment, revision }),
  plan: (environment: string) => request('plan', planSchema, { environment }),
  upgradePlan: (environment: string) =>
    request('upgrade-plan', planSchema, { environment }),
  upgrade: (plan_id: string, digest: string) =>
    request('upgrade', upgradeJobSchema, { plan_id, digest }),
  upgradeJob: (id: string) =>
    request(`upgrade-job?id=${encodeURIComponent(id)}`, upgradeJobSchema),
  review: (plan_id: string, digest: string) =>
    request(
      'review',
      z
        .object({
          plan_id: z.string(),
          digest: z.string(),
          actor: z.string(),
          at: z.string(),
        })
        .strict(),
      { plan_id, digest }
    ),
  history: (environment: string) =>
    request(
      `history?environment=${encodeURIComponent(environment)}`,
      z.object({ items: z.array(eventSchema) }).strict()
    ),
};
