import { cmsClient } from '@/lib/api/client';
import type {
  ModerationReport,
  ModerationReportPage,
  ModerationStatus,
  CommentPolicyReviewPage,
} from '@/types/platform/moderation';

export function listModerationReports(
  status: ModerationStatus | 'all' = 'open',
  page = 1
): Promise<ModerationReportPage> {
  return cmsClient.get<ModerationReportPage>(
    '/admin/moderation/reports',
    { status: status === 'all' ? undefined : status, page }
  );
}

export function listCommentPolicyReviews(): Promise<CommentPolicyReviewPage> {
  return cmsClient.get<CommentPolicyReviewPage>(
    '/admin/moderation/comments/review'
  );
}

export function resolveCommentPolicyReview(
  id: string,
  status: 'allow' | 'removed'
): Promise<{ message: string }> {
  return cmsClient.post<{ message: string }>(
    `/admin/moderation/comments/${id}/review`,
    { status }
  );
}

export function resolveModerationReport(
  id: string,
  status: Exclude<ModerationStatus, 'open'>,
  reason?: string
): Promise<{ data: ModerationReport }> {
  return cmsClient.post<{ data: ModerationReport }>(
    `/admin/moderation/reports/${id}/resolve`,
    { status, reason }
  );
}

export function removeModerationComment(
  id: string
): Promise<{ message: string }> {
  return cmsClient.delete<{ message: string }>(
    `/admin/moderation/comments/${id}`
  );
}

export function getModerationCase(id: string, signal: AbortSignal) {
  return cmsClient.get<{ data: { report: ModerationReport; target_available: boolean; comment_text?: string; parent_id?: string; parent_title?: string } }>(
    '/admin/moderation/reports/' + encodeURIComponent(id), undefined, signal
  ).then(result => result.data);
}

export function getNextModerationCase(id: string, signal: AbortSignal) {
  return cmsClient.get<{ data: { id: string | null } }>(
    '/admin/moderation/reports/' + encodeURIComponent(id) + '/next', undefined, signal
  ).then(response => response.data.id);
}
