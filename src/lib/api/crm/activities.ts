import { crmClient } from '@/lib/api/client';
import type {
    Activity,
    ListActivitiesParams,
    ListActivitiesResponse,
    CreateActivityRequest,
    UpdateActivityRequest,
} from '@/types/crm';

/**
 * List all activities with optional filters
 * GET /admin/activities
 */
export async function listActivities(params?: ListActivitiesParams): Promise<ListActivitiesResponse> {
    return crmClient.get<ListActivitiesResponse>('/admin/activities', params);
}

/**
 * List activities for the current user
 * GET /admin/me/activities
 */
export async function listMyActivities(params?: Omit<ListActivitiesParams, 'owner_id'>): Promise<ListActivitiesResponse> {
    return crmClient.get<ListActivitiesResponse>('/admin/me/activities', params);
}

/**
 * Get a single activity by ID
 * GET /admin/activities/:id
 */
export async function getActivity(id: string): Promise<Activity> {
    return crmClient.get<Activity>(`/admin/activities/${id}`);
}

/**
 * Create a new activity
 * POST /admin/activities
 */
export async function createActivity(data: CreateActivityRequest): Promise<Activity> {
    return crmClient.post<Activity>('/admin/activities', data);
}

/**
 * Update an existing activity
 * PUT /admin/activities/:id
 */
export async function updateActivity(id: string, data: UpdateActivityRequest): Promise<Activity> {
    return crmClient.put<Activity>(`/admin/activities/${id}`, data);
}

/**
 * Delete an activity
 * DELETE /admin/activities/:id
 */
export async function deleteActivity(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/activities/${id}`);
}

/**
 * Mark an activity as complete
 * PATCH /admin/activities/:id/complete
 */
export async function completeActivity(id: string): Promise<Activity> {
    return crmClient.patch<Activity>(`/admin/activities/${id}/complete`);
}
