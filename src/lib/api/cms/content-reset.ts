import { cmsClient, iamClient } from '@/lib/api/client';

type Envelope<T> = { data: T };

export type ContentResetOperation = 'clear' | 'fresh_start' | 'empty';
export type ContentResetLane = 'news' | 'pods' | 'both';
export type ContentResetReauthAction =
  | 'start'
  | 'publish'
  | 'cleanup'
  | 'rollback'
  | 'news_exception'
  | 'history_retirement'
  | 'resume_intake'
  | 'control';
export type ContentResetScopeKind =
  | 'all_lane'
  | 'source_ids'
  | 'explicit_ids'
  | 'published_between'
  | 'created_between';

export interface ContentResetBlocker {
  code: string;
  owner: string;
  reason: string;
  next_action: string;
}

export interface ContentResetCampaign {
  id: string;
  tenant_id: string;
  operation: ContentResetOperation;
  lane: ContentResetLane;
  state: string;
  current_revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContentResetRevision {
  id: string;
  revision: number;
  request: ContentResetPlanRequest;
  state: string;
  selection_highwater: number;
  inventory_highwater: number;
  scan_cursor: number;
  target_count: number;
  protected_count: number;
  unknown_date_count: number;
  unattributed_count: number;
  replay_source_snapshot: Array<{
    id: string;
    category: string;
    type: string;
    config_version: number;
  }>;
  replay_source_hash: string;
  missing_explicit_count: number;
  manifest_hash?: string;
  blockers: ContentResetBlocker[];
  planning_started_at: string;
  planning_completed_at?: string;
  expires_at?: string;
}

export interface ContentResetCampaignDetail {
  campaign: ContentResetCampaign;
  revision: ContentResetRevision;
}

export interface ContentResetValidation {
  campaign_id: string;
  revision: number;
  manifest_hash?: string;
  checked_at: string;
  target_count: number;
  verified_target_count: number;
  manifest_integrity_valid: boolean;
  preview_current: boolean;
  approval_eligible: boolean;
  execution_enabled: boolean;
  issues: Array<{
    code: string;
    owner: string;
    count: number;
    reason: string;
  }>;
  blockers: ContentResetBlocker[];
}

export interface ContentResetEvidence {
  id: string;
  evidence_key: string;
  evidence_type: string;
  owner: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  observed_at: string;
}

export interface ContentResetPlanRequest {
  operation: ContentResetOperation;
  lane: ContentResetLane;
  scope: {
    kind: ContentResetScopeKind;
    source_ids?: string[];
    content_item_ids?: string[];
    from?: string;
    to?: string;
    processing_generation?: number;
    statuses?: Array<
      'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED'
    >;
  };
  coverage_policy: 'preserve_protected' | 'require_exact';
  interaction_policy: 'protect' | 'preserve_history';
  intake_after: 'continue' | 'paused';
  replay: {
    mode:
      | 'none'
      | 'bounded_recent'
      | 'from_now'
      | 'available_history'
      | 'exact_rebuild';
    window_days?: number;
    source_scope?: 'all_active_lane_sources' | 'explicit_sources';
    source_ids?: string[];
  };
  processing_strategy: 'none' | 'copy_verified' | 'recompute';
  capacity_strategy: 'none' | 'build_first' | 'clear_first';
  news_availability_exception_requested?: boolean;
  news_availability_exception_reason?: string;
}

export interface ContentResetTarget {
  content_item_id: string;
  ordinal: number;
  lane: 'news' | 'pods';
  disposition: 'selected' | 'preserve' | 'blocked';
  protected: boolean;
  protection_reason?: string;
  protection_evidence: string[];
  snapshot_hash: string;
  snapshot: {
    type: string;
    status: string;
    source_type?: string;
    processing_generation: number;
    content_source_id?: string | null;
    source_identity_hash?: string;
    source_identity_quality?: 'legacy_ingest_candidate' | 'provider_key_candidate' | 'legacy_unresolved';
    created_at: string;
    published_at?: string | null;
    updated_at: string;
    story_id?: string | null;
    parent_content_item_id?: string | null;
  };
}

export interface ContentResetCapabilities {
  execution_enabled: boolean;
  execution_permission: string;
  release_qualification?: {
    registry: string;
    rubric: string;
    installed_owners: number;
    qualified_owners: number;
    reason: string;
  };
  preview_validation: {
    available: boolean;
    read_only: boolean;
    endpoint: string;
    approval_enabled: boolean;
  };
  operations: Record<
    string,
    { preview: boolean; execute: boolean; reason: string }
  >;
  lanes: Record<string, { execute: boolean; reason: string }>;
  permissions: {
    read: string;
    plan: string;
    execute: string;
    execution_route_available: boolean;
  };
  news_availability_exception: {
    request_in_preview: boolean;
    approve: false;
    execute: false;
    reason: string;
  };
  publication_controls?: {
    publish: boolean;
    rollback: boolean;
    authorize_cleanup: boolean;
    reason: string;
  };
  interaction_history_policy?: {
    available: boolean;
    default: string;
    reason: string;
  };
  protected_interaction_policy: string;
  supported_scope_kinds: ContentResetScopeKind[];
}

const BASE = '/admin/content-reset';

export interface ContentResetExecution {
  id: string;
  version: number;
  phase: string;
  pause_requested: boolean;
  manifest_hash: string;
  approved_by: string;
  approved_at: string;
  approval_expires_at: string;
  started_at?: string;
  irreversible_at?: string;
  published_at?: string;
  cleanup_not_before?: string;
  cleanup_authorized_until?: string;
  rolled_back_at?: string;
  completed_at?: string;
}

export interface ContentResetMilestone {
  id: string;
  kind: 'publication' | 'rollback';
  state: 'active' | 'consumed' | 'revoked';
  manifest_hash: string;
  approved_by: string;
  approved_at: string;
  expires_at: string;
  consumed_at?: string;
}

export interface ContentResetExecutionStatus {
  campaign_id: string;
  state: string;
  execution: ContentResetExecution | null;
  confirmation: string;
  blockers: ContentResetBlocker[];
  steps: Array<{ state: string; count: number }>;
  milestones: ContentResetMilestone[];
  publication_confirmation: string;
  rollback_confirmation: string;
  resume_intake_confirmation: string;
  can_publish: boolean;
  can_rollback: boolean;
  can_authorize_cleanup: boolean;
  can_resume_intake: boolean;
}

export interface ContentResetStagedItem {
  id: string;
  generation_id: string;
  lane: 'news' | 'pods';
  type: string;
  status: string;
  title?: string;
  duration_sec?: number;
  playback_url?: string;
  playback_type?: string;
  fallback_playback_url?: string;
  staged: boolean;
}

export interface ContentResetStep {
  id: string;
  step_key: string;
  owner: string;
  effect: string;
  state: string;
  attempts: number;
  reason_code?: string;
  updated_at: string;
  retry_safe?: boolean;
}

export type ContentResetControlAction =
  | 'approve'
  | 'start'
  | 'pause'
  | 'resume'
  | 'revoke-approval'
  | 'retry'
  | 'publish'
  | 'rollback'
  | 'authorize-cleanup'
  | 'close-partial'
  | 'resume-intake';
export interface ContentResetControlRequest {
  revision: number;
  expected_version: number;
  manifest_hash: string;
  confirmation?: string;
  reauth_proof?: string;
  reason: string;
  step_id?: string;
}

export function getContentResetExecution(id: string): Promise<ContentResetExecutionStatus> {
  return cmsClient.get(`${BASE}/campaigns/${id}/execution`);
}

export function listContentResetSteps(id: string, cursor = 0): Promise<{
  data: ContentResetStep[]; has_more: boolean; next_cursor: number; limit: number;
}> {
  return cmsClient.get(`${BASE}/campaigns/${id}/steps?cursor=${cursor}&limit=50`);
}

export function controlContentResetCampaign(
  id: string, action: ContentResetControlAction, request: ContentResetControlRequest, key: string
): Promise<{ campaign_id: string; state: string; execution: ContentResetExecution }> {
  return cmsClient.post(`${BASE}/campaigns/${id}/${action}`, request, {
    headers: { 'Idempotency-Key': key },
  });
}

export async function getContentResetCapabilities(): Promise<ContentResetCapabilities> {
  return cmsClient.get<ContentResetCapabilities>(`${BASE}/capabilities`);
}

export async function listContentResetCampaigns(): Promise<
  ContentResetCampaign[]
> {
  const response = await cmsClient.get<Envelope<ContentResetCampaign[]>>(
    `${BASE}/campaigns`
  );
  return response.data;
}

export async function createContentResetCampaign(
  request: ContentResetPlanRequest,
  idempotencyKey: string
): Promise<ContentResetCampaignDetail> {
  return cmsClient.post<ContentResetCampaignDetail>(
    `${BASE}/campaigns`,
    request,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
}

export async function getContentResetCampaign(
  id: string
): Promise<ContentResetCampaignDetail> {
  return cmsClient.get<ContentResetCampaignDetail>(`${BASE}/campaigns/${id}`);
}

export async function validateContentResetCampaign(
  id: string
): Promise<ContentResetValidation> {
  return cmsClient.get<ContentResetValidation>(
    `${BASE}/campaigns/${id}/validation`
  );
}

export async function advanceContentResetPlanning(
  id: string,
  expectedCursor: number
): Promise<ContentResetCampaignDetail> {
  return cmsClient.post<ContentResetCampaignDetail>(
    `${BASE}/campaigns/${id}/advance-planning`,
    { expected_cursor: expectedCursor }
  );
}

export async function cancelContentResetCampaign(
  id: string
): Promise<ContentResetCampaignDetail> {
  return cmsClient.post<ContentResetCampaignDetail>(
    `${BASE}/campaigns/${id}/cancel`,
    {}
  );
}

export async function issueContentResetReauth(
  password: string,
  campaignId: string,
  manifestHash: string,
  action: ContentResetReauthAction
): Promise<{ proof: string; expires_in: number }> {
  return iamClient.post<{ proof: string; expires_in: number }>(
    '/auth/reauth',
    {
      password,
      purpose: 'content_reset',
      action,
      plan_id: campaignId,
      manifest_hash: manifestHash,
    }
  );
}

export async function listContentResetTargets(
  id: string,
  cursor = 0,
  limit = 100
): Promise<{
  data: ContentResetTarget[];
  next_cursor: number;
  limit: number;
  has_more: boolean;
}> {
  const query = new URLSearchParams({
    cursor: String(cursor),
    limit: String(limit),
  });
  return cmsClient.get<{
    data: ContentResetTarget[];
    next_cursor: number;
    limit: number;
    has_more: boolean;
  }>(`${BASE}/campaigns/${id}/targets?${query.toString()}`);
}

export async function listContentResetEvidence(
  id: string,
  cursor = 0,
  limit = 50
): Promise<{
  data: ContentResetEvidence[];
  next_cursor: number;
  limit: number;
  has_more: boolean;
}> {
  const query = new URLSearchParams({
    cursor: String(cursor),
    limit: String(limit),
  });
  return cmsClient.get<{
    data: ContentResetEvidence[];
    next_cursor: number;
    limit: number;
    has_more: boolean;
  }>(`${BASE}/campaigns/${id}/evidence?${query.toString()}`);
}

export async function listContentResetStagedItems(
  id: string,
  lane: 'news' | 'pods' = 'pods',
  cursor?: string,
  limit = 100
): Promise<{
  data: ContentResetStagedItem[];
  has_more: boolean;
  next_cursor: string;
  lane: string;
  generation_id: string;
  staged: boolean;
  delivery_protected: boolean;
  delivery_note: string;
}> {
  const query = new URLSearchParams({ lane, limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return cmsClient.get(`${BASE}/campaigns/${id}/staged-items?${query.toString()}`);
}
