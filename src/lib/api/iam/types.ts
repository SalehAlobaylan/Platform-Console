export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    tenant_id?: string;
}

export interface RegisterResponse {
    id: string;
    username: string;
    email: string;
    tenant_id: string;
    created_at: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export interface RefreshTokenRequest {
    refresh_token: string;
}

export interface MeResponse {
    user_id: string;
    email: string;
    tenant_id: string;
    role: string;
    roles: string[];
    permissions: string[];
    is_admin: boolean;
    token_expiry?: number | string;
}

export interface IAMRole {
    id: string;
    name: string;
    description?: string;
}

export interface IAMPermission {
    id: string;
    resource: string;
    action: string;
    description?: string;
    key: string;
}

export interface IAMUser {
    id: string;
    username: string;
    email: string;
    tenant_id: string;
    role: string;
    roles: string[];
    permissions: string[];
    created_at: string;
    updated_at: string;
}
