import { readCookie, runtimeCookie } from './session-cookies';

export function currentRuntimeID(): string {
    return process.env.WAHB_RUNTIME_ID || '';
}

export function hasCurrentRuntimeSession(request: Request): boolean {
    const runtime = currentRuntimeID();
    return !runtime || readCookie(request, runtimeCookie) === runtime;
}

export function sameOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');
    return origin !== null && origin === new URL(request.url).origin;
}

export function rejectInvalidRuntimeRequest(request: Request): Response | undefined {
    const runtime = currentRuntimeID();
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return;
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation && path.startsWith('/api/auth/') && !sameOrigin(request)) {
        return Response.json({ message: 'Same-origin requests are required' }, { status: 403 });
    }
    if (!runtime) {
        if (process.env.WAHB_MANAGED_ENV === '1') {
            return Response.json({ message: 'Console launch configuration is missing' }, { status: 503 });
        }
        return;
    }
    const publicAuth = [
        '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/capabilities',
        '/api/auth/forgot-password', '/api/auth/reset-password',
        '/api/auth/passkeys/authentication/begin', '/api/auth/passkeys/authentication/finish',
    ].includes(path);
    if (mutation && !sameOrigin(request)) {
        return Response.json({ message: 'Same-origin requests are required' }, { status: 403 });
    }
    if ((mutation || request.headers.has('x-wahb-runtime-id')) &&
        request.headers.get('x-wahb-runtime-id') !== runtime) {
        return Response.json({
            message: 'The app restarted. Refresh this tab before continuing.',
            code: 'runtime_changed',
        }, { status: 409 });
    }
    if (!publicAuth && !hasCurrentRuntimeSession(request)) {
        return Response.json({
            message: 'The app restarted. Sign in again.',
            code: 'runtime_changed',
        }, { status: 401 });
    }
}
