import { crmClient } from '@/lib/api/client';
import type {
    Tag,
    CreateTagRequest,
    UpdateTagRequest,
} from '@/types/crm';

/**
 * List all tags
 * GET /admin/tags
 */
export async function listTags(): Promise<Tag[]> {
    return crmClient.get<Tag[]>('/admin/tags');
}

/**
 * Get a single tag by ID
 * GET /admin/tags/:id
 */
export async function getTag(id: string): Promise<Tag> {
    return crmClient.get<Tag>(`/admin/tags/${id}`);
}

/**
 * Create a new tag
 * POST /admin/tags
 */
export async function createTag(data: CreateTagRequest): Promise<Tag> {
    return crmClient.post<Tag>('/admin/tags', data);
}

/**
 * Update an existing tag
 * PUT /admin/tags/:id
 */
export async function updateTag(id: string, data: UpdateTagRequest): Promise<Tag> {
    return crmClient.put<Tag>(`/admin/tags/${id}`, data);
}

/**
 * Delete a tag
 * DELETE /admin/tags/:id
 */
export async function deleteTag(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/tags/${id}`);
}
