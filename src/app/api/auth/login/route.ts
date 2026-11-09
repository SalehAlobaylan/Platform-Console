import { sessionHeaders } from '@/lib/server/session-cookies';

export async function POST(request: Request) {
    const IAM_URL = process.env.IAM_BASE_URL;
    if (!IAM_URL) {
        return Response.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const res = await fetch(`${IAM_URL.replace(/\/$/, '')}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Login failed' }));
        return Response.json(error, { status: res.status });
    }

    const tokens = await res.json();

    return Response.json({ success: true }, { headers: sessionHeaders(tokens) });
}
