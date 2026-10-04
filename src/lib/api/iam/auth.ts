import type {
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    MeResponse,
} from './types';

interface IamError {
    message: string;
    status: number;
    code?: string;
}

async function parseError(res: Response): Promise<IamError> {
    const payload = await res.json().catch(() => ({}));
    return {
        message: payload?.message || payload?.error || `Request failed (${res.status})`,
        status: res.status,
        code: payload?.code,
    };
}

export async function login(request: LoginRequest): Promise<void> {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '' },
        body: JSON.stringify(request),
    });
    if (!res.ok) {
        throw await parseError(res);
    }
}

export async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '' } });
}

export async function refresh(): Promise<void> {
    const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '' } });
    if (!res.ok) {
        throw await parseError(res);
    }
}

export async function getMe(): Promise<MeResponse> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
        throw await parseError(res);
    }
    return res.json();
}

export async function register(request: RegisterRequest): Promise<RegisterResponse> {
    const res = await fetch('/api/iam/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Wahb-Runtime-ID': process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID || '' },
        body: JSON.stringify(request),
    });
    if (!res.ok) {
        throw await parseError(res);
    }
    return res.json();
}
