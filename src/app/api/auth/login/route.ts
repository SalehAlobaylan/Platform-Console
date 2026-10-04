import { bindRuntimeSession, hasCurrentRuntimeSession } from '@/lib/server/runtime-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const IAM_URL = process.env.IAM_BASE_URL;

export async function POST(request: Request) {
    if (!IAM_URL) {
        return NextResponse.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const res = await fetch(`${IAM_URL.replace(/\/$/, '')}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Login failed' }));
        return NextResponse.json(error, { status: res.status });
    }

    const tokens = await res.json();
    const cookieStore = await cookies();

    const secure = process.env.NODE_ENV === 'production';
    const accessMaxAge = tokens.expires_in || 3600;

    cookieStore.set('console_access_token', tokens.access_token, {
        httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: accessMaxAge,
    });
    cookieStore.set('console_refresh_token', tokens.refresh_token, {
        httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 3600,
    });
    cookieStore.set('console_token_expires', String(Date.now() + accessMaxAge * 1000), {
        httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: accessMaxAge,
    });

    bindRuntimeSession(cookieStore);
    return NextResponse.json({ success: true });
}
