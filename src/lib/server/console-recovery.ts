import { authError, authUnavailable, requestIam } from './console-auth';
import { clearSessionHeaders } from './session-cookies';

export async function consoleCapabilities(request: Request) {
    const upstream = await requestIam('/auth/console-capabilities');
    const flags = upstream?.ok ? await upstream.json().catch(() => null) : null;
    const matchingOrigin = flags?.origin === new URL(request.url).origin;
    return Response.json({
        recovery: matchingOrigin && flags?.recovery === true,
        passkeys: matchingOrigin && flags?.passkeys === true,
    });
}

export async function forgotPassword(request: Request) {
    const input = await request.json().catch(() => null);
    if (typeof input?.email !== 'string' || input.email.length > 254 || !input.email.trim()) {
        return authError(400, 'invalid_email', 'Enter a valid email address.');
    }
    const upstream = await requestIam('/auth/forgot-password', {
        body: { email: input.email.trim(), client: 'console' },
        timeout: 12_000,
    });
    if (upstream?.status === 404) return authError(404, 'recovery_disabled', 'Password recovery is unavailable here.');
    if (upstream?.status === 400) return authError(400, 'invalid_email', 'Enter a valid email address.');
    return upstream?.ok ? Response.json({ success: true }) : authUnavailable();
}

export async function resetPassword(request: Request) {
    const input = await request.json().catch(() => null);
    if (typeof input?.token !== 'string' || !input.token || input.token.length > 128 || typeof input.new_password !== 'string' ||
        input.new_password.length < 4 || new TextEncoder().encode(input.new_password).length > 72) {
        return authError(400, 'invalid_reset', 'Use a valid reset link and a password of 4 to 72 bytes.');
    }
    const upstream = await requestIam('/auth/reset-password', { body: { token: input.token, new_password: input.new_password } });
    if (upstream?.status === 400) return authError(400, 'invalid_reset', 'This reset link is invalid or expired. Request a new link.');
    return upstream?.ok ? Response.json({ success: true }, { headers: clearSessionHeaders(true) }) : authUnavailable();
}
