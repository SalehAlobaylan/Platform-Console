import { consoleRuntime } from '@/lib/runtime-config';
import type { LoginRequest, RegisterRequest, RegisterResponse, MeResponse } from './types';

interface IamError {
    message: string;
    status: number;
    code?: string;
}

export async function authRequest(path: string, options: { method?: string; body?: unknown; timeout?: number } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout ?? 10_000);
    try {
        return await fetch(path, {
            method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
            cache: 'no-store',
            signal: controller.signal,
            headers: {
                'X-Wahb-Runtime-ID': consoleRuntime().runtimeId,
                ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
    } finally {
        clearTimeout(timer);
    }
}

export async function parseAuthError(res: Response): Promise<IamError> {
    const payload = await res.json().catch(() => ({}));
    return {
        message: payload?.message || payload?.error || `Request failed (${res.status})`,
        status: res.status,
        code: payload?.code,
    };
}

export type ConsoleLoginRequest = LoginRequest | { mode: 'local-quick-sign-in' };

export async function login(request: ConsoleLoginRequest): Promise<MeResponse> {
    const res = await authRequest('/api/auth/login', { body: request, timeout: 15_000 });
    if (!res.ok) throw await parseAuthError(res);
    return res.json();
}

export async function logout(): Promise<void> {
    const res = await authRequest('/api/auth/logout', { method: 'POST' });
    if (!res.ok) throw await parseAuthError(res);
}

export async function register(request: RegisterRequest): Promise<RegisterResponse> {
    const res = await authRequest('/api/iam/api/v1/auth/register', { body: request });
    if (!res.ok) throw await parseAuthError(res);
    return res.json();
}
