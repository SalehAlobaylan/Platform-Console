// Customer types for CRM Module

export type CustomerStatus = 'active' | 'inactive' | 'lead';

export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    status: CustomerStatus;
    owner_id?: string;
    assigned_to?: string;
    contact_preferences?: Record<string, unknown>;
    follow_up_at?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    // Nested relations
    tags?: Tag[];
    primary_contact?: Contact;
}

export interface Contact {
    id: string;
    customer_id: string;
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    is_primary: boolean;
    created_at: string;
    updated_at: string;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
    customer_count?: number;
    created_at: string;
}

// API request/response types
export interface ListCustomersParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: CustomerStatus;
    owner_id?: string;
    tag_id?: string;
}

export interface ListCustomersResponse {
    data: Customer[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateCustomerRequest {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: CustomerStatus;
    owner_id?: string;
    assigned_to?: string;
    contact_preferences?: Record<string, unknown>;
    follow_up_at?: string;
}

export interface UpdateCustomerRequest {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: CustomerStatus;
    owner_id?: string;
    assigned_to?: string;
    contact_preferences?: Record<string, unknown>;
    follow_up_at?: string;
}

// Contact types
export interface CreateContactRequest {
    customer_id: string;
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    is_primary?: boolean;
}

export interface UpdateContactRequest {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    is_primary?: boolean;
}

// Tag types
export interface CreateTagRequest {
    name: string;
    color: string;
}

export interface UpdateTagRequest {
    name?: string;
    color?: string;
}

// Customer status display labels
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    lead: 'Lead',
};

// Customer status colors for badges
export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, 'success' | 'secondary' | 'warning'> = {
    active: 'success',
    inactive: 'secondary',
    lead: 'warning',
};
