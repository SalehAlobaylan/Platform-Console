import { readCookie } from '@/lib/server/session-cookies';

const ACCESS_COOKIE = 'console_access_token';
const PROBE_TIMEOUT_MS = 10_000;
const IAM_AUTH_TIMEOUT_MS = 5_000;

type RestartTarget = 'cms' | 'iam' | 'aggregation' | 'enrichment';

interface RestartBody {
    service?: RestartTarget;
}

interface TargetConfig {
    name: RestartTarget;
    envKey: string;
    path: string;
    auth: 'cookie-jwt' | 'service-token';
}

interface IAMAccess {
    user_id?: string;
    email?: string;
    roles?: string[];
    is_admin?: boolean;
}

async function requireAdmin(request: Request): Promise<
    | { access: IAMAccess }
    | { response: Response }
> {
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) {
        return { response: Response.json({ message: 'Not authenticated' }, { status: 401 }) };
    }
    const iamBaseUrl = process.env.IAM_BASE_URL;
    if (!iamBaseUrl) {
        return { response: Response.json({ message: 'IAM_BASE_URL is not configured' }, { status: 500 }) };
    }
    let upstream: Response;
    try {
        upstream = await fetch(`${iamBaseUrl.replace(/\/$/, '')}/api/v1/roles/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(IAM_AUTH_TIMEOUT_MS),
        });
    } catch {
        return { response: Response.json({ message: 'Authorization service unavailable' }, { status: 503 }) };
    }
    if (upstream.status === 401 || upstream.status === 403) {
        return { response: Response.json({ message: 'Not authenticated' }, { status: 401 }) };
    }
    if (!upstream.ok) {
        return { response: Response.json({ message: 'Authorization service unavailable' }, { status: 503 }) };
    }
    const access = (await upstream.json()) as IAMAccess;
    const hasAdminRole = Boolean(access.is_admin) || (access.roles ?? []).some(
        (role) => role.toLowerCase() === 'admin'
    );
    if (!hasAdminRole) {
        return { response: Response.json({ message: 'Admin role required' }, { status: 403 }) };
    }
    return { access };
}

const TARGETS: Record<RestartTarget, TargetConfig> = {
    cms: { name: 'cms', envKey: 'CMS_BASE_URL', path: '/admin/restart', auth: 'cookie-jwt' },
    iam: {
        name: 'iam',
        envKey: 'IAM_BASE_URL',
        path: '/api/v1/admin/restart',
        auth: 'cookie-jwt',
    },
    aggregation: {
        name: 'aggregation',
        envKey: 'AGGREGATION_BASE_URL',
        path: '/admin/restart',
        auth: 'cookie-jwt',
    },
    enrichment: {
        name: 'enrichment',
        envKey: 'ENRICHMENT_BASE_URL',
        path: '/v1/admin/restart',
        auth: 'service-token',
    },
};

export async function POST(request: Request): Promise<Response> {
	const authorization = await requireAdmin(request);
	if ('response' in authorization) return authorization.response;

    let body: RestartBody;
    try {
        body = (await request.json()) as RestartBody;
    } catch {
        return Response.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const service = body.service;
    if (!service || !TARGETS[service]) {
        return Response.json(
            { message: `service must be one of: ${Object.keys(TARGETS).join(', ')}` },
            { status: 400 }
        );
    }

    const target = TARGETS[service];
    const baseUrl = process.env[target.envKey];
    if (!baseUrl) {
        return Response.json(
            { message: `${target.envKey} is not configured` },
            { status: 500 }
        );
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (target.auth === 'cookie-jwt') {
        const token = readCookie(request, ACCESS_COOKIE);
        if (!token) {
            return Response.json(
                { message: 'Not authenticated' },
                { status: 401 }
            );
        }
        headers.set('Authorization', `Bearer ${token}`);
    } else {
        const serviceToken = process.env.ENRICHMENT_RESTART_TOKEN;
        if (!serviceToken) {
            return Response.json(
                { message: 'ENRICHMENT_RESTART_TOKEN is not configured' },
                { status: 500 }
            );
        }
        headers.set('Authorization', `Bearer ${serviceToken}`);
		headers.set('X-Operator-Email', authorization.access.email ?? authorization.access.user_id ?? 'admin');
		headers.set('X-Request-ID', request.headers.get('X-Request-ID') ?? crypto.randomUUID());
    }

    const url = `${baseUrl.replace(/\/$/, '')}${target.path}`;

    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });

        const text = await upstream.text();
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }

        return Response.json(
            { service, upstreamStatus: upstream.status, upstreamBody: parsed },
            { status: upstream.ok ? 202 : upstream.status }
        );
    } catch (err) {
        return Response.json(
            {
                service,
                message: 'Restart request failed',
                error: err instanceof Error ? err.message : 'Unknown error',
            },
            { status: 502 }
        );
    }
}
