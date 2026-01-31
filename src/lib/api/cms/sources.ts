import { cmsClient } from '@/lib/api/client';
import type {
    ContentSource,
    ListSourcesParams,
    ListSourcesResponse,
    CreateSourceRequest,
    UpdateSourceRequest,
    RunSourceResponse,
} from '@/types/platform/source';

/**
 * List all content sources with optional filters
 * GET /admin/sources
 */
export async function listSources(params?: ListSourcesParams): Promise<ListSourcesResponse> {
    return cmsClient.get<ListSourcesResponse>('/admin/sources', params);
}

/**
 * Get a single content source by ID
 * GET /admin/sources/:id
 */
export async function getSource(id: string): Promise<ContentSource> {
    return cmsClient.get<ContentSource>(`/admin/sources/${id}`);
}

/**
 * Create a new content source
 * POST /admin/sources
 */
export async function createSource(data: CreateSourceRequest): Promise<ContentSource> {
    return cmsClient.post<ContentSource>('/admin/sources', data);
}

/**
 * Update an existing content source
 * PUT /admin/sources/:id
 */
export async function updateSource(id: string, data: UpdateSourceRequest): Promise<ContentSource> {
    return cmsClient.put<ContentSource>(`/admin/sources/${id}`, data);
}

/**
 * Delete a content source
 * DELETE /admin/sources/:id
 */
export async function deleteSource(id: string): Promise<void> {
    return cmsClient.delete<void>(`/admin/sources/${id}`);
}

/**
 * Trigger ingestion for a content source
 * POST /admin/sources/:id/run
 */
export async function runSource(id: string): Promise<RunSourceResponse> {
    return cmsClient.post<RunSourceResponse>(`/admin/sources/${id}/run`);
}
