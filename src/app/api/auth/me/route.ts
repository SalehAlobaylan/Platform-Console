import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const IAM_URL = process.env.IAM_BASE_URL;

export async function GET() {
    if (!IAM_URL) {
        return NextResponse.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 });
    }

    const cookieStore = await cookies();
    if (!hasCurrentRuntimeSession(cookieStore)) return NextResponse.json({ message: 'Sign in again for this runtime' }, { status: 401 });
    const accessToken = cookieStore.get('console_access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
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

    return NextResponse.json(parsed, { status: res.status });
}
