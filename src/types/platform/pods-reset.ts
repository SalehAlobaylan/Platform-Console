export type PodsResetState =
  | 'preview'
  | 'approved'
  | 'executing'
  | 'partial'
  | 'complete'
  | 'cancelled';
export type PodsResetDisposition =
  | 'delete_owned_payload'
  | 'preserve_shared'
  | 'retain_identity'
  | 'detach_or_recompute'
  | 'protected'
  | 'blocked';

export interface PodsResetBlocker {
  code: string;
  message: string;
}

export interface PodsResetCandidateQuery {
  type?: 'VIDEO' | 'PODCAST' | 'ALL';
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED' | 'ALL';
  source_id?: string;
  created_after?: string;
  created_before?: string;
  processing_after?: string;
  processing_before?: string;
  cursor?: string;
  limit?: number;
}

export interface PodsResetCandidate {
  content_item_id: string;
  type: 'VIDEO' | 'PODCAST';
  source: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
  content_source_id?: string;
  created_at: string;
  updated_at: string;
  processing_generation: number;
  retirement_identity_available: boolean;
  processing_provenance: 'unknown';
  provenance_note: string;
  stage_evidence: Array<{
    processing_generation: number;
    stage: string;
    state: string;
    policy_version: string;
    updated_at: string;
  }>;
}

export interface PodsResetCandidatePage {
  items: PodsResetCandidate[];
  has_more: boolean;
  next_cursor: string;
  page_size: number;
  provenance_policy: string;
}

export interface PodsResetDecision {
  class: string;
  disposition: PodsResetDisposition;
  owner: string;
  reason: string;
  postcondition: string;
}

export interface PodsResetTargetPreview {
  content_item_id: string;
  snapshot: Record<string, unknown>;
  storage_tiers: string[];
  storage_version_model: string;
  metadata_counts: Record<string, number>;
  data_decisions: PodsResetDecision[];
  blockers: PodsResetBlocker[];
  objects: PodsResetObject[];
}

export interface PodsResetObject {
  content_item_id?: string;
  storage_tier: string;
  bucket: string;
  object_key: string;
  etag: string;
  size_bytes: number;
  state?: string;
  deleted_by_run?: boolean;
  freed_bytes?: number;
  error?: string;
}

export interface PodsResetItem {
  content_item_id: string;
  state: string;
  snapshot_hash: string;
  decision: PodsResetDecision[] | Record<string, unknown>;
  blocked_reasons: PodsResetBlocker[];
  last_error?: string;
  verification_probe_count?: number;
  verification_not_before?: string;
  verification_evidence?: { probes?: Array<Record<string, unknown>> };
  completed_at?: string;
}

export interface PodsResetAction {
  id: string;
  run_id: string;
  content_item_id: string;
  action: 'payload_retired';
  manifest_hash: string;
  result: Record<string, unknown>;
  created_at: string;
}

export interface PodsResetTotals {
  hard_deleted_rows: number;
  retired_identities: number;
  objects_deleted: number;
  objects_already_absent: number;
  bytes_freed: number;
  blocked_items: number;
  pending_items: number;
}

export interface PodsResetRun {
  id: string;
  tenant_id: string;
  state: PodsResetState;
  phase: string;
  manifest_hash: string;
  schema_fingerprint: string;
  policy_version: number;
  manifest: Record<string, unknown>;
  pause_requested: boolean;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  expires_at: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface PodsResetPlanDetail {
  run: PodsResetRun;
  items: PodsResetItem[] | PodsResetTargetPreview[];
  objects: PodsResetObject[];
  actions: PodsResetAction[];
  can_cancel: boolean;
  rollback: string;
}

export interface PodsResetPreviewResponse {
  run: PodsResetRun;
  items: PodsResetTargetPreview[];
  approval_phrase: string;
  counts: { selected_ids: number; object_count: number; object_bytes: number };
  can_approve: boolean;
}

export interface PodsResetExecutionResponse {
  id: string;
  state: PodsResetState;
  outcome?: string;
  rollback?: string;
  resume_allowed?: boolean;
  items?: PodsResetItem[];
  totals?: PodsResetTotals;
  error?: string;
}
