import { crmClient } from '@/lib/api/client';
import type {
    Customer,
    Contact,
    Tag,
    ListCustomersParams,
    ListCustomersResponse,
    CreateCustomerRequest,
    UpdateCustomerRequest,
    CreateContactRequest,
    UpdateContactRequest,
} from '@/types/crm';

/**
 * List all customers with optional filters
 * GET /admin/customers
 */
export async function listCustomers(params?: ListCustomersParams): Promise<ListCustomersResponse> {
    return crmClient.get<ListCustomersResponse>('/admin/customers', params);
}

/**
 * Get a single customer by ID
 * GET /admin/customers/:id
 */
export async function getCustomer(id: string): Promise<Customer> {
    return crmClient.get<Customer>(`/admin/customers/${id}`);
}

/**
 * Create a new customer
 * POST /admin/customers
 */
export async function createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return crmClient.post<Customer>('/admin/customers', data);
}

/**
 * Update an existing customer
 * PUT /admin/customers/:id
 */
export async function updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    return crmClient.put<Customer>(`/admin/customers/${id}`, data);
}

/**
 * Soft delete a customer
 * DELETE /admin/customers/:id
 */
export async function deleteCustomer(id: string): Promise<void> {
    return crmClient.delete<void>(`/admin/customers/${id}`);
}

/**
 * List contacts for a customer
 * GET /admin/customers/:id/contacts
 */
export async function listCustomerContacts(customerId: string): Promise<Contact[]> {
    return crmClient.get<Contact[]>(`/admin/customers/${customerId}/contacts`);
}

/**
 * Create a contact for a customer
 * POST /admin/customers/:id/contacts
 */
export async function createCustomerContact(customerId: string, data: Omit<CreateContactRequest, 'customer_id'>): Promise<Contact> {
    return crmClient.post<Contact>(`/admin/customers/${customerId}/contacts`, { ...data, customer_id: customerId });
}

/**
 * Get customer tags
 * GET /admin/customers/:id/tags
 */
export async function getCustomerTags(customerId: string): Promise<Tag[]> {
    return crmClient.get<Tag[]>(`/admin/customers/${customerId}/tags`);
}

/**
 * Assign tags to a customer
 * POST /admin/customers/:id/tags
 */
export async function assignCustomerTags(customerId: string, tagIds: string[]): Promise<void> {
    return crmClient.post<void>(`/admin/customers/${customerId}/tags`, { tag_ids: tagIds });
}

/**
 * Remove a tag from a customer
 * DELETE /admin/customers/:id/tags/:tagId
 */
export async function removeCustomerTag(customerId: string, tagId: string): Promise<void> {
    return crmClient.delete<void>(`/admin/customers/${customerId}/tags/${tagId}`);
}
