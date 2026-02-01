import { crmClient } from '@/lib/api/client';
import type {
    Deal,
    ListDealsParams,
    ListDealsResponse,
    CreateDealRequest,
    UpdateDealRequest,
    UpdateDealStageRequest,
} from '@/types/crm';

/**
 * List all deals with optional filters
 * GET /admin/deals
 */
export async function listDeals(params?: ListDealsParams): Promise<ListDealsResponse> {
    return crmClient.get<ListDealsResponse>('/admin/deals', params);
}

/**
 * Get a single deal by ID
 * GET /admin/deals/:id
 */
export async function getDeal(id: string): Promise<Deal> {
    return crmClient.get<Deal>(`/admin/deals/${id}`);
}

/**
 * Create a new deal
 * POST /admin/deals
 */
export async function createDeal(data: CreateDealRequest): Promise<Deal> {
    return crmClient.post<Deal>('/admin/deals', data);
}

/**
 * Update an existing deal
 * PUT /admin/deals/:id
 */
export async function updateDeal(id: string, data: UpdateDealRequest): Promise<Deal> {
    return crmClient.put<Deal>(`/admin/deals/${id}`, data);
}

/**
 * Delete a deal
 * DELETE /admin/deals/:id
 */
export async function deleteDeal(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/deals/${id}`);
}

/**
 * Update deal stage
 * PATCH /admin/deals/:id/stage
 */
export async function updateDealStage(id: string, data: UpdateDealStageRequest): Promise<Deal> {
    return crmClient.patch<Deal>(`/admin/deals/${id}/stage`, data);
}
