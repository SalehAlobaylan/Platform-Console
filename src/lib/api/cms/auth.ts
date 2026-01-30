import { cmsClient } from '@/lib/api/client';
import type { LoginRequest, LoginResponse, MeResponse } from './types';

/**
 * Authenticate user with email and password
 * POST /admin/login
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
    return cmsClient.post<LoginResponse>('/admin/login', request);
}

/**
 * Get current authenticated user info
 * GET /admin/me
 */
export async function getMe(): Promise<MeResponse> {
    return cmsClient.get<MeResponse>('/admin/me');
}
