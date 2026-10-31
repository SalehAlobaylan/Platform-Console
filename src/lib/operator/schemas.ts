import { z } from 'zod';

import { OPERATOR_CONTRACT_VERSION } from '@/types/platform/operator';

const filterValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.array(z.string()).max(100),
]);

export function isInternalOperatorDeepLink(value: string): boolean {
  if (
    value.trim() !== value ||
    !value.startsWith('/platform/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return false;
  try {
    const parsed = new URL(value, 'https://console.invalid');
    const rawPath = value.split(/[?#]/, 1)[0];
    const decodedPath = decodeURIComponent(rawPath);
    const segments = decodedPath.split('/');
    return (
      parsed.origin === 'https://console.invalid' &&
      parsed.pathname === rawPath &&
      parsed.pathname.startsWith('/platform/') &&
      !decodedPath.startsWith('//') &&
      !decodedPath.includes('\\') &&
      !decodedPath.includes('//') &&
      !segments.some((segment) => segment === '.' || segment === '..') &&
      !/[\u0000-\u001f\u007f]/.test(decodedPath)
    );
  } catch {
    return false;
  }
}

const internalDeepLinkSchema = z
  .string()
  .refine(isInternalOperatorDeepLink, 'Internal Console deep link required.');
// CMS serializes RFC 3339 timestamps. PostgreSQL may preserve the caller's
// numeric offset rather than normalizing every API value to a trailing `Z`.
const operatorDateTimeSchema = z.string().datetime({ offset: true });

export const operatorSubjectRefSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().min(1),
    label: z.string().min(1).optional(),
  })
  .strict();

export const operatorVisibleContextSchema = z
  .object({
    schema_version: z.literal(OPERATOR_CONTRACT_VERSION),
    domain: z.string().min(1),
    view: z.string().min(1),
    filters: z.record(filterValueSchema),
    subjects: z.array(operatorSubjectRefSchema),
    selection: z
      .object({
        mode: z.enum(['explicit', 'filtered']),
        ids: z.array(z.string().min(1)).max(20).optional(),
        count: z.number().int().min(0),
        truncated: z.boolean().optional(),
      })
      .strict()
      .optional(),
    draft: z
      .object({
        kind: z.string().min(1),
        safe_normalized_fields: z.record(z.unknown()),
      })
      .strict()
      .optional(),
    available_intents: z
      .array(
        z.enum(['explain', 'investigate', 'recommend', 'resolve', 'compare'])
      )
      .min(1),
  })
  .strict()
  .superRefine((context, issueContext) => {
    if (context.selection?.mode === 'explicit') {
      if (
        context.selection.truncated ||
        context.selection.ids?.length !== context.selection.count
      ) {
        issueContext.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Explicit selection must be complete and exact.',
        });
      }
    }
  });

export const operatorEvidenceRefSchema = z
  .object({
    evidence_id: z.string().min(1),
    authority: z.enum(['live', 'derived', 'temporal', 'retrieved', 'memory']),
    domain: z.string().min(1),
    adapter_key: z.string().min(1),
    adapter_version: z.string().min(1),
    tenant_id: z.string().min(1),
    required_permission: z.string().min(1),
    record_refs: z.array(operatorSubjectRefSchema),
    deep_link: internalDeepLinkSchema,
    observed_at: operatorDateTimeSchema,
    fetched_at: operatorDateTimeSchema,
    max_age_seconds: z.number().int().positive(),
    expires_at: operatorDateTimeSchema,
    content_hash: z.string().min(1),
    source_version: z.string().min(1),
    availability: z.enum([
      'available',
      'partial',
      'stale',
      'unavailable',
      'conflicting',
    ]),
  })
  .strict();

export const operatorDecisionPacketSchema = z
  .object({
    schema_version: z.literal(OPERATOR_CONTRACT_VERSION),
    packet_id: z.string().min(1),
    fingerprint: z.string().min(1),
    tenant_id: z.string().min(1),
    actor_id: z.string().min(1),
    visible_context: operatorVisibleContextSchema,
    collection_started_at: operatorDateTimeSchema,
    collection_ended_at: operatorDateTimeSchema,
    completeness: z.enum(['complete', 'partial']),
    facts: z.array(
      z
        .object({
          key: z.string().min(1),
          value: z.unknown(),
          evidence_ids: z.array(z.string().min(1)).min(1),
        })
        .strict()
    ),
    evidence: z.array(operatorEvidenceRefSchema),
    warnings: z.array(z.string()).optional(),
    unknowns: z.array(z.string()).optional(),
    conflicts: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((packet, issueContext) => {
    const evidenceIDs = new Set(
      packet.evidence.map((evidence) => evidence.evidence_id)
    );
    for (const evidence of packet.evidence) {
      if (evidence.tenant_id !== packet.tenant_id) {
        issueContext.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Evidence tenant must match packet tenant.',
        });
      }
    }
    for (const fact of packet.facts) {
      if (fact.evidence_ids.some((id) => !evidenceIDs.has(id))) {
        issueContext.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Facts may only cite packet evidence.',
        });
      }
    }
  });

const forbiddenToolTerms = [
  'delete',
  'purge',
  'iam.',
  'password',
  'secret',
  'token',
  'migration',
  'raw sql',
  'shell',
  'restart',
  'arbitrary url',
  'queue',
];

export const operatorToolDescriptorSchema = z
  .object({
    key: z.string().min(1),
    version: z.string().min(1),
    owner_domain: z.string().min(1),
    target_type: z.string().min(1),
    argument_schema: z.string().min(1),
    required_permission: z.string().min(1),
    risk_tier: z.enum(['read', 'routine', 'high_impact']),
    batchable: z.boolean(),
    target_cap: z.number().int().min(1).max(20),
    executor: z.string().min(1),
    monitor: z.string().min(1),
    verifier: z.string().min(1),
    idempotency: z.string().min(1),
    cancellation: z.string().min(1),
    rollback: z.string().min(1),
    affected_domains: z.array(z.string().min(1)).min(1),
    localized_action_key: z.string().min(1),
  })
  .strict()
  .superRefine((tool, issueContext) => {
    if (!tool.batchable && tool.target_cap !== 1) {
      issueContext.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Non-batch tools may target only one record.',
      });
    }
    const searchable = [
      tool.key,
      tool.owner_domain,
      tool.target_type,
      tool.argument_schema,
      tool.executor,
    ]
      .join(' ')
      .toLowerCase();
    if (forbiddenToolTerms.some((term) => searchable.includes(term))) {
      issueContext.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Forbidden Operator capability.',
      });
    }
  });

const operatorUUIDSchema = z.string().uuid();
const operatorEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    event_type: z.string().min(1).max(80),
    tenant_id: z.string().min(1),
    created_at: operatorDateTimeSchema,
    payload: z.record(z.unknown()).optional(),
  })
  .strict();

const operatorEventEnvelopeSchema = z
  .object({
    state: z.string().min(1).max(32),
    events: z.array(operatorEventSchema).max(500),
    next_sequence: z.number().int().nonnegative(),
  })
  .strict();

export const operatorEventResponseSchema = operatorEventEnvelopeSchema
  .extend({
    investigation_id: operatorUUIDSchema,
  })
  .strict();

export const operatorPlanEventResponseSchema = operatorEventEnvelopeSchema
  .extend({
    id: operatorUUIDSchema,
  })
  .strict();

// The CMS returns the complete signed-plan envelope in `canonical_plan`.
// Keep this schema aligned with the Go contract instead of validating only
// the display fields; strict parsing is intentional so a stale or forged
// plan cannot reach the approval controls.
const operatorCanonicalPlanSchema = z
  .object({
    schema_version: z.literal(OPERATOR_CONTRACT_VERSION),
    plan_id: z.string().min(1),
    tenant_id: z.string().min(1),
    actor_id: z.string().min(1),
    tool_key: z.string().min(1).max(160),
    tool_version: z.string().min(1).max(40),
    target_ids: z.array(z.string().min(1)).min(1).max(20),
    normalized_arguments: z.record(z.unknown()),
    evidence_ids: z.array(z.string().min(1)).min(1),
    evidence_fingerprint: z.string().min(1),
    access_version: z.string().min(1),
    risk_tier: z.enum(['routine', 'high_impact']),
    cancellation: z.string().min(1),
    rollback: z.string().min(1),
    contingencies: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const operatorPlanSchema = z
  .object({
    id: operatorUUIDSchema,
    state: z.enum([
      'awaiting_approval',
      'queued',
      'claimed',
      'running',
      'verifying',
      'succeeded',
      'failed',
      'blocked',
      'cancelled',
    ]),
    tool_key: z.string().min(1).max(160),
    risk_tier: z.enum(['routine', 'high_impact']),
    expires_at: operatorDateTimeSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/i),
    confirmation_phrases: z.array(z.string().min(1).max(100)).max(2).optional(),
    investigation_id: operatorUUIDSchema.optional(),
    localized_action_key: z.string().min(1).optional(),
    target_type: z.string().min(1).optional(),
    canonical_plan: operatorCanonicalPlanSchema,
    affected_domains: z.array(z.string().min(1)).min(1).max(26).optional(),
    verified_effects: z
      .object({
        affected_domains: z.array(z.string().min(1)).max(26).optional(),
        affected_subjects: z.array(z.string().min(1)).max(50).optional(),
        deep_links: z.array(internalDeepLinkSchema).max(50).optional(),
        before: z.unknown().optional(),
        after: z.unknown().optional(),
        verified: z.unknown().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const operatorInboxSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: operatorUUIDSchema,
            state: z.string().min(1).max(32),
            locale: z.enum(['en', 'ar']),
            started_at: operatorDateTimeSchema,
            finished_at: operatorDateTimeSchema.optional(),
            read_at: operatorDateTimeSchema.optional(),
            error_class: z.string().max(120).optional(),
          })
          .strict()
      )
      .max(100)
      .optional(),
    unread_count: z.number().int().nonnegative().optional(),
  })
  .strict();

export const operatorThreadSchema = z
  .object({
    id: operatorUUIDSchema,
    title: z.string().min(1).max(240),
    locale: z.enum(['en', 'ar']),
    last_activity_at: operatorDateTimeSchema,
    expires_at: operatorDateTimeSchema,
    created_at: operatorDateTimeSchema,
    pinned_at: operatorDateTimeSchema.nullable().optional(),
    archived_at: operatorDateTimeSchema.nullable().optional(),
    last_domain: z.string().min(1).optional(),
    last_state: z.string().min(1).optional(),
    unread_count: z.number().int().nonnegative().optional(),
    activity_state: z
      .enum([
        'idle',
        'queued',
        'working',
        'needs_approval',
        'needs_review',
        'failed',
        'completed',
        'cancelled',
      ])
      .optional(),
    active_investigation_count: z.number().int().nonnegative().optional(),
  })
  .strict();

export const operatorThreadListSchema = z
  .object({
    items: z.array(operatorThreadSchema).max(100),
    next_cursor: z.string(),
  })
  .strict();

export const operatorRecommendationListSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: operatorUUIDSchema,
            rank: z.number().int().min(1).max(4),
            state: z.string().min(1),
            expires_at: operatorDateTimeSchema,
            title: z.string().min(1),
            summary: z.string(),
            deep_link: internalDeepLinkSchema,
            manual_only: z.boolean(),
          })
          .strict()
      )
      .max(4),
  })
  .strict()
  .superRefine((value, context) => {
    const ranks = value.items.map((item) => item.rank);
    if (
      new Set(ranks).size !== ranks.length ||
      ranks.some((rank, index) => rank !== index + 1)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Recommendations must be CMS-ranked from primary through secondary.',
      });
  });

export const operatorScheduleListSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: operatorUUIDSchema,
            state: z.string().min(1).max(32),
            cadence: z.string().min(1).max(100),
            next_run_at: operatorDateTimeSchema.nullable().optional(),
            paused_reason: z.string().max(200).optional(),
            owner_id: z.string().min(1).max(255),
            read_only: z.literal(true),
          })
          .strict()
      )
      .max(100)
      .optional(),
  })
  .strict();

export const operatorControlsSchema = z
  .object({
    operational: z.literal(true),
    controls: z
      .object({
        read_enabled: z.boolean(),
        llm_enabled: z.boolean(),
        execution_enabled: z.boolean(),
        schedules_enabled: z.boolean(),
        adapters: z.array(z.object({}).passthrough()).optional(),
      })
      .strict()
      .optional(),
    spend: z
      .object({ interactive: z.boolean(), scheduled_hard_stop: z.boolean() })
      .strict()
      .optional(),
    metrics: z.record(z.number()).optional(),
  })
  .strict();

export const operatorStatusSchema = z
  .object({
    operational: z.literal(true),
    controls: z
      .object({
        read_enabled: z.boolean(),
        llm_enabled: z.boolean(),
        execution_enabled: z.boolean(),
        schedules_enabled: z.boolean(),
      })
      .strict(),
  })
  .passthrough();

const operatorPlanActionSchema = z
  .object({
    kind: z.literal('plan'),
    key: z.string().min(1).max(160),
    localized_action_key: z.string().min(1),
    risk_tier: z.enum(['routine', 'high_impact']),
    target_type: z.string().min(1),
    argument_schema: z.string().min(1),
    target_ids: z.array(z.string().min(1)).min(1).max(20),
    affected_domains: z.array(z.string().min(1)).min(1).max(26),
    cancellation: z.string().min(1),
    rollback: z.string().min(1),
    contingencies: z.array(z.string().min(1)),
    manual_only: z.literal(false),
  })
  .strict();

const operatorManualActionSchema = z
  .object({
    kind: z.literal('manual'),
    localized_action_key: z.string().min(1),
    reason_key: z.string().min(1),
    affected_domain: z.string().min(1),
    deep_link: internalDeepLinkSchema,
    manual_only: z.literal(true),
  })
  .strict();

export const operatorEligibleActionsSchema = z
  .object({
    packet_fingerprint: z.string().min(1).optional(),
    execution_enabled: z.boolean(),
    items: z
      .array(
        z.discriminatedUnion('kind', [
          operatorPlanActionSchema,
          operatorManualActionSchema,
        ])
      )
      .max(100),
  })
  .strict();

export const operatorInvestigationStartSchema = z
  .object({
    investigation_id: operatorUUIDSchema,
    state: z.literal('backgrounded'),
    visible_context: operatorVisibleContextSchema.optional(),
  })
  .strict();

const operatorMessageSchema = z
  .object({
    id: operatorUUIDSchema,
    kind: z.string().min(1).max(32),
    actor_type: z.enum(['admin', 'operator', 'system']),
    created_at: operatorDateTimeSchema,
    content: z.unknown(),
    investigation_id: operatorUUIDSchema.optional(),
    plan_id: operatorUUIDSchema.optional(),
  })
  .strict();

export const operatorThreadDetailSchema = z
  .object({
    thread: operatorThreadSchema,
    messages: z.array(operatorMessageSchema).max(200),
    older_cursor: z.string().max(2000).optional(),
  })
  .strict();

export const operatorBriefingSchema = z
  .object({
    generated_at: operatorDateTimeSchema,
    context: operatorVisibleContextSchema,
    headline: z.string().min(1),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            domain: z.string().min(1),
            kind: z.string(),
            severity: z.string(),
            title: z.string(),
            summary: z.string(),
            deep_link: internalDeepLinkSchema.optional(),
          })
          .strict()
      )
      .max(20),
    suggested_questions: z
      .array(
        z
          .object({
            intent: z.enum([
              'explain',
              'investigate',
              'recommend',
              'resolve',
              'compare',
            ]),
            text: z.string().min(1).max(8000),
          })
          .strict()
      )
      .max(8),
  })
  .strict();

export const operatorEvidenceListSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: operatorUUIDSchema,
            evidence_id: z.string().min(1),
            authority: z.string().min(1),
            domain: z.string().min(1),
            adapter_key: z.string().min(1),
            adapter_version: z.string().min(1),
            required_permission: z.string().min(1),
            record_refs: z.unknown(),
            deep_link: internalDeepLinkSchema,
            observed_at: operatorDateTimeSchema,
            fetched_at: operatorDateTimeSchema,
            expires_at: operatorDateTimeSchema,
            availability: z.string().min(1),
            source_version: z.string().min(1),
          })
          .strict()
      )
      .max(500),
  })
  .strict();

export const operatorTaskSchema = z
  .object({
    error_class: z.string().max(120).optional(),
    expires_at: operatorDateTimeSchema.optional(),
    id: operatorUUIDSchema,
    kind: z.enum(['investigation', 'plan', 'schedule', 'schedule_run']),
    title: z.string().min(1),
    domain: z.string().optional(),
    state: z.string().min(1),
    risk_tier: z.string().optional(),
    started_at: operatorDateTimeSchema,
    updated_at: operatorDateTimeSchema,
    unread: z.boolean().optional(),
    can_cancel: z.boolean(),
    deep_link: internalDeepLinkSchema,
    thread_id: operatorUUIDSchema.optional(),
    investigation_id: operatorUUIDSchema.optional(),
    plan_id: operatorUUIDSchema.optional(),
    schedule_id: operatorUUIDSchema.optional(),
    schedule_run_id: operatorUUIDSchema.optional(),
  })
  .strict();

export const operatorTaskListSchema = z
  .object({
    items: z.array(operatorTaskSchema).max(200),
    next_cursor: z.string(),
  })
  .strict();
