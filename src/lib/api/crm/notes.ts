import { crmClient } from '@/lib/api/client';
import type {
    Note,
    ListNotesParams,
    ListNotesResponse,
    CreateNoteRequest,
} from '@/types/crm';

/**
 * List notes for a customer
 * GET /admin/customers/:id/notes
 */
export async function listCustomerNotes(customerId: string, params?: Pick<ListNotesParams, 'page' | 'limit'>): Promise<ListNotesResponse> {
    return crmClient.get<ListNotesResponse>(`/admin/customers/${customerId}/notes`, params);
}

/**
 * List notes for a deal
 * GET /admin/deals/:id/notes
 */
export async function listDealNotes(dealId: string, params?: Pick<ListNotesParams, 'page' | 'limit'>): Promise<ListNotesResponse> {
    return crmClient.get<ListNotesResponse>(`/admin/deals/${dealId}/notes`, params);
}

/**
 * Get a single note by ID
 * GET /admin/notes/:id
 */
export async function getNote(id: string): Promise<Note> {
    return crmClient.get<Note>(`/admin/notes/${id}`);
}

/**
 * Create a new note
 * POST /admin/notes
 */
export async function createNote(data: CreateNoteRequest): Promise<Note> {
    return crmClient.post<Note>('/admin/notes', data);
}

/**
 * Delete a note
 * DELETE /admin/notes/:id
 */
export async function deleteNote(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/notes/${id}`);
}
