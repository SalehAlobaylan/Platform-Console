import type { MeResponse, TokenResponse } from '@/lib/api/iam/types';
import { sessionHeaders } from './session-cookies';

export function authError(status: number, code: string, message: string) {
    return Response.json({ code, message }, { status });
}

export function authUnavailable() {
    return authError(503, 'session_unavailable', 'The sign-in service is temporarily unavailable. Try again.');
}

export async function requestIam(path: string, options?: { body?: unknown; access?: string; timeout?: number }) {
    const base = process.env.IAM_BASE_URL;
    if (!base) return undefined;
    try {
        return await fetch(base.replace(/\/$/, '') + '/api/v1' + path, {
            method: options?.body === undefined ? 'GET' : 'POST',
            headers: {
                ...(options?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
                ...(options?.access ? { Authorization: `Bearer ${options.access}` } : {}),
            },
            body: options?.body === undefined ? undefined : JSON.stringify(options.body),
            signal: AbortSignal.timeout(options?.timeout ?? 4_000),
            redirect: 'error',
            cache: 'no-store',
        });
    } catch {
        return undefined;
    }
}

export async function readTokens(response: Response): Promise<TokenResponse | undefined> {
    const tokens = await response.json().catch(() => null) as TokenResponse | null;
    if (typeof tokens?.access_token !== 'string' || !tokens.access_token ||
        typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) return;
    return tokens;
}

export async function readProfile(response: Response): Promise<MeResponse | undefined> {
    const profile = await response.json().catch(() => null) as MeResponse | null;
    if (!profile || typeof profile.user_id !== 'string' || !profile.user_id ||
        typeof profile.tenant_id !== 'string' || typeof profile.email !== 'string' ||
        typeof profile.role !== 'string' || typeof profile.is_admin !== 'boolean' ||
        (profile.roles != null && (!Array.isArray(profile.roles) || !profile.roles.every((role) => typeof role === 'string'))) ||
        (profile.permissions != null && (!Array.isArray(profile.permissions) || !profile.permissions.every((permission) => typeof permission === 'string')))) return;
    const { user_id, tenant_id, email, role, is_admin, roles, permissions, token_expiry } = profile;
    return {
        user_id, tenant_id, email, role, is_admin, roles: roles ?? [], permissions: permissions ?? [],
        token_expiry: typeof token_expiry === 'number' || typeof token_expiry === 'string' ? token_expiry : undefined,
    };
}

export async function finishSignIn(response: Response | undefined) {
    if (response?.status === 401 || response?.status === 403) {
        return authError(401, 'invalid_credentials', 'Sign-in was rejected. Check your credentials and try again.');
    }
    if (!response?.ok) return authUnavailable();
    const tokens = await readTokens(response);
    if (!tokens) return authUnavailable();

    const identity = await requestIam('/roles/me', { access: tokens.access_token });
    const profile = identity?.ok ? await readProfile(identity) : undefined;
    if (!profile) {
        await requestIam('/auth/revoke-session', { body: { refresh_token: tokens.refresh_token } });
        return authUnavailable();
    }
    return Response.json(profile, { headers: sessionHeaders(tokens) });
}
