import { cmsClient } from '@/lib/api/client';

export type NewsAction = 'enable' | 'disable' | 'pause' | 'resume';
export interface NewsRequest { action: NewsAction; scope: 'all' | 'selected'; ids?: string[] }
export interface NewsReadiness { ready: boolean; paused: boolean; control_version: number; blockers: string[] }
export interface NewsPreview {
    id: string; action: NewsAction; expires_at: string;
    snapshot: { scope: string; readiness: NewsReadiness; sources: Array<{ id: string; name: string; type: string; active: boolean; outcome: string; reason?: string }> };
}
export interface NewsResult { id: string; action: NewsAction; changed: number; unchanged: number; excluded: number; applied_at: string }
export interface NewsStatus {
    readiness: NewsReadiness; total: number; enabled: number; needs_configuration: number;
    environment: string; tenant_id: string; can_manage: boolean;
    operations: Array<{ id: string; action: NewsAction; result: NewsResult; applied_at: string; snapshot?: NewsPreview['snapshot'] }>;
    configuration_issues?: Array<{ id: string; name: string; type: string; reason: string }>;
}
export const getNewsCollection = () => cmsClient.get<NewsStatus>('/admin/sources/news/collection');
export const previewNewsCollection = (request: NewsRequest) => cmsClient.post<NewsPreview>('/admin/sources/news/operations/preview', request);
export const applyNewsCollection = (id: string) => cmsClient.post<NewsResult>(`/admin/sources/news/operations/${id}/apply`);
