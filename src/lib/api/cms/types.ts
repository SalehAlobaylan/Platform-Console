// User type used across the application
export interface User {
    tenant_id?: string;
    id: string;
    email: string;
    role: string;
    permissions?: string[];
}

// Admin user types (used by IAM admin-users module)
export interface AdminUser {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ListAdminUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    is_active?: boolean;
}

export interface ListAdminUsersResponse {
    data: AdminUser[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface CreateAdminUserRequest {
    email: string;
    password: string;
    role: string;
    permissions?: string[];
    is_active?: boolean;
}

export interface UpdateAdminUserRequest {
    email?: string;
    role?: string;
    permissions?: string[];
    is_active?: boolean;
}

export interface ResetAdminUserPasswordRequest {
    password: string;
}
