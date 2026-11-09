import { authUnavailable, requestIam } from '@/lib/server/console-auth';
import { clearSessionHeaders, readCookie } from '@/lib/server/session-cookies';
import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';

export async function POST(request: Request) {
    const refresh = readCookie(request, 'console_refresh_token');
    if (refresh && hasCurrentRuntimeSession(request)) {
        const response = await requestIam('/auth/revoke-session', { body: { refresh_token: refresh } });
        if (!response?.ok) return authUnavailable();
    }

    return Response.json({ success: true }, { headers: clearSessionHeaders(true) });
}
