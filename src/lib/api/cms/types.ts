// User type used across the application
export interface User {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
}

// Login request/response types
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: {
        id: string;
        email: string;
        role: string;
    };
}

// Get current user response
export interface MeResponse {
    id: string;
    email: string;
    role: string;
    permissions: string[];
}
