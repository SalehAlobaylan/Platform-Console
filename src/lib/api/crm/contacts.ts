import { crmClient } from '@/lib/api/client';
import type {
    Contact,
    CreateContactRequest,
    UpdateContactRequest,
} from '@/types/crm';

/**
 * Get a single contact by ID
 * GET /admin/contacts/:id
 */
export async function getContact(id: string): Promise<Contact> {
    return crmClient.get<Contact>(`/admin/contacts/${id}`);
}

/**
 * Update an existing contact
 * PUT /admin/contacts/:id
 */
export async function updateContact(id: string, data: UpdateContactRequest): Promise<Contact> {
    return crmClient.put<Contact>(`/admin/contacts/${id}`, data);
}

/**
 * Delete a contact
 * DELETE /admin/contacts/:id
 */
export async function deleteContact(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/contacts/${id}`);
}

/**
 * Set a contact as primary
 * PATCH /admin/contacts/:id/primary
 */
export async function setContactPrimary(id: string): Promise<void> {
    return crmClient.patch<void>(`/admin/contacts/${id}/primary`);
}
