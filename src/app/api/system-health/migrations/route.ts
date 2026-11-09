import { readCookie } from '@/lib/server/session-cookies';

const ACCESS_COOKIE = 'console_access_token';
const MIGRATE_TIMEOUT_MS = 60_000;

interface MigrateBody {
    service?: 'iam';
}

export async function POST(request: Request): Promise<Response> {
    if (process.env.WAHB_MANAGED_ENV === '1') return Response.json({ message: 'Stop the stack, then use scripts/env.sh prepare for the selected environment.', cockpit: '/platform/database-migrations' }, { status: 409 });
    let body: MigrateBody;
    try {
        body = (await request.json()) as MigrateBody;
    } catch {
        return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.service !== 'iam') {
        return Response.json(
            { message: 'Only service="iam" is currently supported' },
            { status: 400 }
        );
    }

    const baseUrl = process.env.IAM_BASE_URL;
    if (!baseUrl) {
        return Response.json(
            { message: 'IAM_BASE_URL is not configured' },
            { status: 500 }
        );
    }

    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) {
        return Response.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/admin/migrations/up`;

    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(MIGRATE_TIMEOUT_MS),
        });

        const text = await upstream.text();
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }

        return Response.json(
            { service: 'iam', upstreamStatus: upstream.status, upstreamBody: parsed },
            { status: upstream.ok ? 200 : upstream.status }
        );
    } catch (err) {
        return Response.json(
            {
                service: 'iam',
                message: 'Migration request failed',
                error: err instanceof Error ? err.message : 'Unknown error',
            },
            { status: 502 }
        );
    }
}
