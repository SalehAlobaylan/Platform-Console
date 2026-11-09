import { readCookie } from '@/lib/server/session-cookies';
import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';

export async function GET(request: Request) {
    const IAM_URL = process.env.IAM_BASE_URL;
    if (!IAM_URL) {
        return Response.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 });
    }

    if (!hasCurrentRuntimeSession(request)) return Response.json({ message: 'Sign in again for this runtime' }, { status: 401 });
    const accessToken = readCookie(request, 'console_access_token');

    if (!accessToken) {
        return Response.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const res = await fetch(`${IAM_URL.replace(/\/$/, '')}/api/v1/roles/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    const text = await res.text();
    let parsed: unknown;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = text;
    }

    return Response.json(parsed, { status: res.status });
}
