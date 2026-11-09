import { authError, authUnavailable, readProfile, requestIam } from '@/lib/server/console-auth';
import { hasCurrentRuntimeSession } from '@/lib/server/runtime-session';
import { readCookie, runtimeCookie } from '@/lib/server/session-cookies';

export async function GET(request: Request) {
    const access = readCookie(request, 'console_access_token');
    const refresh = readCookie(request, 'console_refresh_token');
    if (!hasCurrentRuntimeSession(request)) {
        if (access || refresh || readCookie(request, runtimeCookie)) {
            return authError(401, 'runtime_changed', 'The app restarted. Sign in again.');
        }
        return authError(401, 'no_session', 'Sign in to continue.');
    }

    const expired = () => refresh
        ? authError(401, 'access_expired', 'The access session expired.')
        : authError(401, 'no_session', 'Sign in to continue.');
    if (!access) return expired();
    const response = await requestIam('/roles/me', { access });
    if (response?.status === 401) return expired();
    const profile = response?.ok ? await readProfile(response) : undefined;
    return profile ? Response.json(profile) : authUnavailable();
}
