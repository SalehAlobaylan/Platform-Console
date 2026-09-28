import { cmsClient } from '@/lib/api/client';
import type {
  PodsResetExecutionResponse,
  PodsResetCandidatePage,
  PodsResetCandidateQuery,
  PodsResetPlanDetail,
  PodsResetPreviewResponse,
  PodsResetRun,
} from '@/types/platform/pods-reset';

type Envelope<T> = { data: T };
const BASE = '/admin/pods-reset';

export async function listPodsResetCandidates(
  filters: PodsResetCandidateQuery
): Promise<PodsResetCandidatePage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const response = await cmsClient.get<Envelope<PodsResetCandidatePage>>(
    `${BASE}/candidates${query.size ? `?${query.toString()}` : ''}`
  );
  return response.data;
}

export async function createPodsResetPreview(
  contentIds: string[],
  selectionReason: string
): Promise<PodsResetPreviewResponse> {
  const response = await cmsClient.post<Envelope<PodsResetPreviewResponse>>(
    `${BASE}/plans`,
    { content_ids: contentIds, selection_reason: selectionReason }
  );
  return response.data;
}

export async function getPodsResetPlan(
  id: string
): Promise<PodsResetPlanDetail> {
  const response = await cmsClient.get<Envelope<PodsResetPlanDetail>>(
    `${BASE}/plans/${id}`
  );
  return response.data;
}

export async function listPodsResetRuns(): Promise<PodsResetRun[]> {
  const response = await cmsClient.get<Envelope<{ items: PodsResetRun[] }>>(
    `${BASE}/runs`
  );
  return response.data.items ?? [];
}

export async function approvePodsResetPlan(
  id: string,
  phrase: string
): Promise<{ id: string; state: string; manifest_hash: string }> {
  const response = await cmsClient.post<
    Envelope<{ id: string; state: string; manifest_hash: string }>
  >(`${BASE}/plans/${id}/approve`, { phrase });
  return response.data;
}

export async function cancelPodsResetPlan(
  id: string
): Promise<{ id: string; state: string }> {
  const response = await cmsClient.post<
    Envelope<{ id: string; state: string }>
  >(`${BASE}/plans/${id}/cancel`, {});
  return response.data;
}

export async function requestPodsResetPause(
  id: string
): Promise<{ id: string; pause_requested: boolean }> {
  const response = await cmsClient.post<
    Envelope<{ id: string; pause_requested: boolean }>
  >(`${BASE}/plans/${id}/pause`, {});
  return response.data;
}

export async function resumePodsResetRun(
  id: string
): Promise<{ id: string; pause_requested: boolean; state: string }> {
  const response = await cmsClient.post<
    Envelope<{ id: string; pause_requested: boolean; state: string }>
  >(`${BASE}/plans/${id}/resume`, {});
  return response.data;
}

export async function executePodsResetRun(
  id: string
): Promise<PodsResetExecutionResponse> {
  const response = await cmsClient.post<Envelope<PodsResetExecutionResponse>>(
    `${BASE}/plans/${id}/execute`,
    {}
  );
  return response.data;
}
