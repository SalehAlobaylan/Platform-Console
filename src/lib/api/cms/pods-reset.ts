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

export async function listPodsResetCandidates(filters: PodsResetCandidateQuery): Promise<PodsResetCandidatePage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const queryString = query.toString();
  const response = await cmsClient.get<Envelope<PodsResetCandidatePage>>(
    `${BASE}/candidates${queryString ? `?${queryString}` : ''}`
  );
  return response.data;
}

export async function createPodsResetPreview(
  contentIds: string[],
  selectionReason: string,
  protectionOverrides?: { codes: string[]; reason: string }
): Promise<PodsResetPreviewResponse> {
  const response = await cmsClient.post<Envelope<PodsResetPreviewResponse>>(`${BASE}/plans`, {
    content_ids: contentIds,
    selection_reason: selectionReason,
    ...(protectionOverrides && {
      protection_override_codes: protectionOverrides.codes,
      protection_override_reason: protectionOverrides.reason,
    }),
  });
  return response.data;
}

export async function createPodsResetQuantityPreview(
  itemCount: number,
  filters: PodsResetCandidateQuery,
  selectionReason: string
) {
  if (!Number.isSafeInteger(itemCount) || itemCount < 1) {
    throw new Error('Enter a positive whole number.');
  }
  const ids: string[] = [];
  const seenIDs = new Set<string>();
  const seenCursors = new Set<string>();
  const selectionTitles: Record<string, string> = {};
  let cursor: string | undefined;
  while (ids.length < itemCount) {
    const page = await listPodsResetCandidates({
      ...filters,
      cursor,
      limit: Math.min(100, itemCount - ids.length),
    });
    if (page.total_count !== undefined && page.total_count < itemCount) {
      throw new Error(
        `Only ${page.total_count} matching items are available. Refresh the filters and enter a smaller number.`
      );
    }
    for (const item of page.items) {
      if (ids.length === itemCount) break;
      if (seenIDs.has(item.content_item_id))
        throw new Error('Matching inventory changed. Refresh and prepare a new preview.');
      seenIDs.add(item.content_item_id);
      ids.push(item.content_item_id);
      selectionTitles[item.content_item_id] = item.title?.trim() || 'Untitled content';
    }
    if (ids.length === itemCount) break;
    if (!page.items.length || !page.has_more || !page.next_cursor || seenCursors.has(page.next_cursor)) {
      throw new Error(
        `Only ${ids.length} matching items could be selected. Refresh the filters and enter a smaller number.`
      );
    }
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  const preview = await createPodsResetPreview(ids, selectionReason);
  return { ...preview, selectionTitles };
}

export async function getPodsResetPlan(id: string): Promise<PodsResetPlanDetail> {
  const response = await cmsClient.get<Envelope<PodsResetPlanDetail>>(`${BASE}/plans/${id}`);
  return response.data;
}

export async function listPodsResetRuns(): Promise<PodsResetRun[]> {
  const response = await cmsClient.get<Envelope<{ items: PodsResetRun[] }>>(`${BASE}/runs`);
  return response.data.items ?? [];
}

export async function approvePodsResetPlan(
  id: string,
  phrase: string
): Promise<{ id: string; state: string; manifest_hash: string }> {
  const response = await cmsClient.post<Envelope<{ id: string; state: string; manifest_hash: string }>>(
    `${BASE}/plans/${id}/approve`,
    { phrase }
  );
  return response.data;
}

export async function cancelPodsResetPlan(id: string): Promise<{ id: string; state: string }> {
  const response = await cmsClient.post<Envelope<{ id: string; state: string }>>(`${BASE}/plans/${id}/cancel`, {});
  return response.data;
}

export async function requestPodsResetPause(id: string): Promise<{ id: string; pause_requested: boolean }> {
  const response = await cmsClient.post<Envelope<{ id: string; pause_requested: boolean }>>(
    `${BASE}/plans/${id}/pause`,
    {}
  );
  return response.data;
}

export async function resumePodsResetRun(id: string): Promise<{ id: string; pause_requested: boolean; state: string }> {
  const response = await cmsClient.post<Envelope<{ id: string; pause_requested: boolean; state: string }>>(
    `${BASE}/plans/${id}/resume`,
    {}
  );
  return response.data;
}

export async function executePodsResetRun({
  id,
  manifestHash,
  confirmedItemCount,
}: {
  id: string;
  manifestHash: string;
  confirmedItemCount: number;
}, onProgress?: (progress: PodsResetExecutionResponse) => void | Promise<void>, signal?: AbortSignal): Promise<PodsResetExecutionResponse> {
  for (;;) {
    const response = await cmsClient.post<Envelope<PodsResetExecutionResponse>>(`${BASE}/plans/${id}/execute`, {
      manifest_hash: manifestHash,
      confirmed_item_count: confirmedItemCount,
    });
    const progress = response.data;
    await onProgress?.(progress);
    if (signal?.aborted || progress.state !== 'partial' || !progress.resume_allowed ||
      !['fencing', 'batch_complete', 'verification_wait'].includes(progress.phase ?? '') ||
      progress.warning || progress.error || !progress.items?.length ||
      progress.items.some((item) => item.state !== 'complete' && item.last_error && item.last_error !== 'verification_probe_not_due')) {
      return progress;
    }
    const pending = progress.items.filter((item) => item.state !== 'complete');
    const runnable = pending.some((item) => item.state !== 'verification_pending' ||
      !item.verification_not_before || Date.parse(item.verification_not_before) <= Date.now());
    const due = pending.map((item) => Date.parse(item.verification_not_before ?? '')).filter(Number.isFinite);
    const waitMs = runnable || !due.length ? 0 : Math.min(60_000, Math.max(0, Math.min(...due) - Date.now()));
    if (waitMs > 0) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, waitMs);
        signal?.addEventListener('abort', finish, { once: true });
        if (signal?.aborted) finish();
      });
    }
    if (signal?.aborted) return progress;
  }
}
