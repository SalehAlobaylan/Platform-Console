export type FeedRecoveryLane = 'news' | 'media' | 'both';
export type FeedRecoveryLevel = 'repair' | 'rotate';
export interface FeedRecoveryPlan {
  id: string;
  tenant_id: string;
  lane: FeedRecoveryLane;
  level: FeedRecoveryLevel;
  capacity_mode: 'safe_cutover' | 'low_space_reset';
  state: string;
  plan_hash: string;
  manifest_hash: string;
  target_root_hash?: string;
  target_scope?: string;
  target_segments?: number;
  target_byte_size?: number;
  source_checksum: string;
  source_count: number;
  target_count: number;
  no_full_rollback: boolean;
  expires_at: string;
  evidence: Record<string, unknown>;
  purge_manifest?: Record<string, unknown>;
}
export interface FeedRecoveryRun {
  id: string;
  plan_id?: string;
  phase: string;
  lane: string;
  correlation_id: string;
  expected_empty?: boolean;
  destructive_lane?: string;
  recovery_artifact_ref?: string;
  not_before?: string;
  cancel_deadline?: string;
  heartbeat_at?: string;
  claim_expires_at?: string;
  lane_lease?: string;
  rollback_deadline?: string;
  verification_due_at?: string;
  active_generation_id?: string;
  candidate_generation_id?: string;
  outcome?: string;
  error?: string;
  created_at: string;
}
export interface FeedRecoveryAction {
  id: string;
  action_type: string;
  state: string;
  evidence?: Record<string, unknown>;
  error?: string;
  created_at: string;
}
