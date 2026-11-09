import { readCookie, sessionHeaders, clearSessionHeaders } from '@/lib/server/session-cookies';
import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';

export async function POST(request: Request) {
    const IAM_URL = process.env.IAM_BASE_URL;
    if (!IAM_URL) {
        return Response.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 });
    }

    if (!hasCurrentRuntimeSession(request)) return Response.json({ message: 'Sign in again for this runtime' }, { status: 401 });
    const refreshToken = readCookie(request, 'console_refresh_token');

    if (!refreshToken) {
        return Response.json({ message: 'No session' }, { status: 401 });
    }

    const res = await fetch(`${IAM_URL.replace(/\/$/, '')}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Refresh failed' }));
        return Response.json(error, { status: res.status, headers: clearSessionHeaders() });
    }

    const tokens = await res.json();
    return Response.json({ success: true }, { headers: sessionHeaders(tokens) });
}
