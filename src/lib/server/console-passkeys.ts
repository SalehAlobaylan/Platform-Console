import { serialize } from 'cookie';
import { authError, authUnavailable, finishSignIn, requestIam } from './console-auth';
import { currentRuntimeID } from './runtime-session';
import { readCookie } from './session-cookies';

type Operation = 'authentication' | 'registration';

const cookiePath = '/api/auth/passkeys';

function bindingCookie(request: Request, operation: Operation, value: string, maxAge: number) {
    return serialize(`console_passkey_${operation}`, value, {
        path: cookiePath, httpOnly: true, sameSite: 'strict',
        secure: new URL(request.url).protocol === 'https:', maxAge,
    });
}

function passkeyFailure(response?: Response) {
    if (response?.status === 404) return authError(404, 'passkeys_disabled', 'Passkeys are unavailable here.');
    if (response?.status === 400) return authError(400, 'passkey_rejected', 'This passkey request could not be verified. Try again.');
    if (response?.status === 401 || response?.status === 403) {
        return authError(401, 'passkey_rejected', 'We couldn’t verify your passkey or password. Try again.');
    }
    return authUnavailable();
}

export async function beginPasskey(request: Request, operation: Operation) {
    const access = readCookie(request, 'console_access_token');
    if (operation === 'registration' && !access) return authError(401, 'no_session', 'Sign in to continue.');
    const input = operation === 'registration' ? await request.json().catch(() => null) : null;
    const upstream = await requestIam(`/auth/passkeys/${operation}/begin`, {
        body: operation === 'registration' ? { password: input?.password } : {},
        access: operation === 'registration' ? access : undefined,
    });
    if (!upstream?.ok) return passkeyFailure(upstream);

    const result = await upstream.json().catch(() => null);
    if (!result?.options?.publicKey || typeof result.binding !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.binding)) {
        return authUnavailable();
    }
    const binding = currentRuntimeID() + ':' + result.binding;
    return Response.json(result.options, { headers: { 'Set-Cookie': bindingCookie(request, operation, binding, 300) } });
}

export async function finishPasskey(request: Request, operation: Operation) {
    const access = readCookie(request, 'console_access_token');
    if (operation === 'registration' && !access) return authError(401, 'no_session', 'Sign in to continue.');
    const stored = readCookie(request, `console_passkey_${operation}`);
    const prefix = currentRuntimeID() + ':';
    const input = await request.json().catch(() => null);
    if (!stored?.startsWith(prefix) || !input?.credential || typeof input.credential !== 'object') {
        return authError(400, 'passkey_expired', 'This passkey request expired. Try again.');
    }
    const upstream = await requestIam(`/auth/passkeys/${operation}/finish`, {
        body: { binding: stored.slice(prefix.length), credential: input.credential },
        access: operation === 'registration' ? access : undefined,
    });
    const response = upstream?.ok
        ? operation === 'authentication' ? await finishSignIn(upstream) : new Response(null, { status: 204 })
        : passkeyFailure(upstream);
    response.headers.append('Set-Cookie', bindingCookie(request, operation, '', 0));
    return response;
}

export async function listPasskeys(request: Request) {
    const access = readCookie(request, 'console_access_token');
    if (!access) return authError(401, 'no_session', 'Sign in to continue.');
    const upstream = await requestIam('/auth/passkeys', { access });
    if (!upstream?.ok) return passkeyFailure(upstream);
    const items = await upstream.json().catch(() => null);
    return Array.isArray(items) ? Response.json(items) : authUnavailable();
}

export async function removePasskey(request: Request) {
    const access = readCookie(request, 'console_access_token');
    if (!access) return authError(401, 'no_session', 'Sign in to continue.');
    const input = await request.json().catch(() => null);
    const upstream = await requestIam('/auth/passkeys/remove', { access, body: { id: input?.id, password: input?.password } });
    return upstream?.ok ? new Response(null, { status: 204 }) : passkeyFailure(upstream);
}
