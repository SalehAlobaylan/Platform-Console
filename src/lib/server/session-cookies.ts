import { parse, serialize } from 'cookie';

export function readCookie(request: Request, name: string) {
    return parse(request.headers.get('cookie') ?? '')[name];
}

const sessionCookies = [
    'console_access_token',
    'console_refresh_token',
    'console_token_expires',
] as const;

export const runtimeCookie = 'console_runtime_id';

function appendCookie(headers: Headers, name: string, value: string, maxAge: number) {
    headers.append('Set-Cookie', serialize(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    }));
}

export function sessionHeaders(tokens: { access_token: string; refresh_token: string; expires_in?: number }) {
    const headers = new Headers();
    const accessMaxAge = tokens.expires_in || 3600;
    appendCookie(headers, sessionCookies[0], tokens.access_token, accessMaxAge);
    appendCookie(headers, sessionCookies[1], tokens.refresh_token, 30 * 24 * 3600);
    appendCookie(headers, sessionCookies[2], String(Date.now() + accessMaxAge * 1000), accessMaxAge);
    const runtime = process.env.WAHB_RUNTIME_ID;
    if (runtime) appendCookie(headers, runtimeCookie, runtime, 30 * 24 * 3600);
    return headers;
}

export function clearSessionHeaders(clearRuntime = false) {
    const headers = new Headers();
    for (const name of clearRuntime ? [...sessionCookies, runtimeCookie] : sessionCookies) {
        headers.append('Set-Cookie', serialize(name, '', { path: '/', expires: new Date(0) }));
    }
    return headers;
}
