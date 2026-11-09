import { authError, authUnavailable, readTokens, requestIam } from '@/lib/server/console-auth';
import { readCookie, sessionHeaders } from '@/lib/server/session-cookies';
import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';

export async function POST(request: Request) {
    if (!hasCurrentRuntimeSession(request)) {
        return authError(401, 'runtime_changed', 'The app restarted. Sign in again.');
    }
    const refreshToken = readCookie(request, 'console_refresh_token');
    if (!refreshToken) return authError(401, 'no_session', 'Sign in to continue.');

    const response = await requestIam('/auth/refresh', { body: { refresh_token: refreshToken } });
    // A concurrent tab may already have rotated this credential. A failed
    // refresh must never clear cookies written by the winning request.
    if (response?.status === 401) return authError(401, 'session_rejected', 'Your session expired. Sign in again.');
    const tokens = response?.ok ? await readTokens(response) : undefined;
    return tokens ? Response.json({ success: true }, { headers: sessionHeaders(tokens) }) : authUnavailable();
}
