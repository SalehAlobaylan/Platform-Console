import { cmsClient } from '@/lib/api/client';

export interface PodsAutomationStatus {
  paused: boolean;
  version: string;
  environment: string;
  tenant_id: string;
  can_manage: boolean;
  ready: boolean;
  active_sources: number;
  active_steps: number;
  queued_steps: number;
  active_source_runs: number;
  processing_mode: 'automatic' | 'manual';
  automatic_source_overrides: number;
  source_override_count?: number;
  auto_publish: boolean;
  chaptering_enabled: boolean;
  updated_at: string;
  updated_by: string;
  observed_at?: string;
  pause_reason?: string;
  activity?: PodsPipelineActivityCounts;
}

export interface PodsPipelineActivityCounts {
  running_steps: number;
  claimed_steps: number;
  verifying_steps: number;
  unresolved_steps: number;
  queued_steps: number;
  running_source_runs: number;
  admitted_source_runs: number;
  verifying_source_runs: number;
  queued_source_runs: number;
}

export interface PodsPipelineEvent {
  id: string;
  event_at: string;
  kind: 'source_run' | 'publication';
  title: string;
  trigger: string;
  actor?: string;
  outcome: string;
  content_id?: string;
  source_id?: string;
  units?: number;
}

export interface PodsPipelineActivityPage {
  items: PodsPipelineEvent[];
  next_cursor: string;
  observed_at: string;
}

export const getPodsAutomation = () =>
  cmsClient.get<PodsAutomationStatus>('/admin/media/automation');
export const setPodsAutomation = (paused: boolean, version: string) =>
  cmsClient.patch<PodsAutomationStatus>('/admin/media/automation', {
    paused,
    expected_version: version,
  });

export const getPodsPipelineActivity = (
  cursor?: string,
  signal?: AbortSignal
) =>
  cmsClient.get<PodsPipelineActivityPage>(
    '/admin/media/automation/activity',
    cursor ? { cursor } : undefined,
    signal
  );
