import { z } from 'zod';

export const migrationActionSchema = z
  .object({
    key: z.string(),
    version: z.string(),
    class: z.enum(['read_only', 'approval_required', 'manual_only']),
    execution_owner: z.string(),
    verification_owner: z.string(),
    rollback_class: z.string(),
    enabled: z.boolean(),
  })
  .strict();
export const migrationUnitSchema = z
  .object({
    id: z.string().uuid(),
    program_id: z.string().uuid(),
    unit_key: z.string(),
    source_database_id: z.string().uuid(),
    target_database_id: z.string().uuid(),
    source_epoch: z.number().int().nonnegative(),
    target_epoch: z.number().int().nonnegative(),
    state: z.string(),
    evidence_fingerprint: z.string().length(64),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();
export const migrationProgramSchema = z
  .object({
    id: z.string().uuid(),
    environment: z.string(),
    source_alias: z.string(),
    target_alias: z.string(),
    control_alias: z.string(),
    state: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    manifest_hash: z.string().optional(),
    policy_version: z.string(),
    units: z.array(migrationUnitSchema),
  })
  .strict();
export const migrationStatusSchema = z
  .object({
    status: z.enum(['ready', 'not_configured', 'unavailable']),
    control_store_ready: z.boolean(),
    execution_enabled: z.boolean(),
    observed_at: z.string(),
  })
  .strict()
  .refine((value) => value.control_store_ready === (value.status === 'ready'), {
    message: 'Relocation status contradicts control-store readiness',
  });
export const migrationActionsPayloadSchema = z
  .object({
    items: z.array(migrationActionSchema),
    execution_enabled: z.boolean(),
  })
  .strict();
export const migrationProgramsPayloadSchema = z
  .object({ items: z.array(migrationProgramSchema) })
  .strict();
export type MigrationAction = z.infer<typeof migrationActionSchema>;
export type MigrationProgram = z.infer<typeof migrationProgramSchema>;
export type MigrationStatus = z.infer<typeof migrationStatusSchema>;

async function getJSON<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`/api/database-migrations/${path}`, {
    cache: 'no-store',
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Relocation coordinator returned an unreadable response.');
  }
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body && 'message' in body
        ? String(body.message)
        : 'Relocation coordinator unavailable'
    );
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      `Relocation coordinator returned invalid ${path} data. Check again or ask a developer to inspect its response.`
    );
  return parsed.data;
}
export const databaseMigrationAPI = {
  status: () => getJSON('status', migrationStatusSchema),
  actions: () => getJSON('actions', migrationActionsPayloadSchema),
  programs: () => getJSON('programs', migrationProgramsPayloadSchema),
};
