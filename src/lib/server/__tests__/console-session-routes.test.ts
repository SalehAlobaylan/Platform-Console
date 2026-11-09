/** @jest-environment node */
import { POST as login } from '@/app/api/auth/login/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as logout } from '@/app/api/auth/logout/route';

const origin = 'http://localhost:3005';

function post(path: string, body?: object, cookie?: string) {
    return new Request(origin + path, {
        method: 'POST',
        headers: { origin, ...(cookie ? { cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
}

beforeEach(() => jest.replaceProperty(process, 'env', {
    ...process.env, IAM_BASE_URL: 'http://iam.test', WAHB_RUNTIME_ID: '',
}));
afterEach(() => jest.restoreAllMocks());

it('sets no cookies and revokes the newly minted refresh token if identity verification fails', async () => {
    const iam = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh' }))
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await login(post('/api/auth/login', { email: 'operator@example.test', password: 'fixture-only' }));
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(iam).toHaveBeenNthCalledWith(3, 'http://iam.test/api/v1/auth/revoke-session',
        expect.objectContaining({ body: JSON.stringify({ refresh_token: 'fixture-refresh' }) }));
});

it.each([401, 503])('preserves browser cookies when refresh returns %s', async (status) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
    const response = await refresh(post('/api/auth/refresh', undefined, 'console_refresh_token=fixture-refresh'));
    expect(response.status).toBe(status);
    expect(response.headers.get('set-cookie')).toBeNull();
});

it('uses the refresh credential to sign out after access expiry and waits for IAM', async () => {
    const iam = jest.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const request = post('/api/auth/logout', undefined, 'console_refresh_token=fixture-refresh');
    const unavailable = await logout(request);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('set-cookie')).toBeNull();
    const confirmed = await logout(request);
    expect(confirmed.ok).toBe(true);
    expect(confirmed.headers.get('set-cookie')).toContain('console_refresh_token=');
    expect(iam).toHaveBeenCalledWith('http://iam.test/api/v1/auth/revoke-session',
        expect.objectContaining({ body: JSON.stringify({ refresh_token: 'fixture-refresh' }) }));
});
