/** @jest-environment node */
import { POST } from '@/app/api/auth/login/route';

const origin = 'http://localhost:3005';

function quickSignIn(target = origin) {
    return POST(new Request(`${target}/api/auth/login`, {
        method: 'POST',
        headers: { origin: target, 'x-wahb-runtime-id': 'fixture-launch' },
        body: JSON.stringify({ mode: 'local-quick-sign-in' }),
    }));
}

beforeEach(() => {
    jest.replaceProperty(process, 'env', {
        ...process.env,
        NODE_ENV: 'development',
        WAHB_MANAGED_ENV: '1',
        WAHB_RUNTIME_ID: 'fixture-launch',
        IAM_BASE_URL: 'http://fixture-iam.test',
        LOCAL_QUICK_SIGN_IN_EMAIL: 'operator@example.test',
        LOCAL_QUICK_SIGN_IN_PASSWORD: 'fixture-only',
    });
});

afterEach(() => jest.restoreAllMocks());

it('logs in through IAM without credentials from the browser', async () => {
    const profile = { user_id: 'fixture-user', tenant_id: 'default', email: 'operator@example.test', role: 'admin', roles: ['admin'], permissions: [], is_admin: true };
    const iam = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
        access_token: 'fixture-access',
        refresh_token: 'fixture-refresh',
    })).mockResolvedValueOnce(Response.json(profile));
    const response = await quickSignIn();
    expect(iam).toHaveBeenCalledWith('http://fixture-iam.test/api/v1/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'operator@example.test', password: 'fixture-only' }),
    }));
    expect(response.headers.get('set-cookie')).toContain('console_access_token=fixture-access');
    expect(await response.json()).toEqual(profile);
});

it.each([
    ['production', () => { process.env.NODE_ENV = 'production'; }, origin],
    ['an unmanaged launch', () => { delete process.env.WAHB_MANAGED_ENV; }, origin],
    ['a missing credential', () => { delete process.env.LOCAL_QUICK_SIGN_IN_PASSWORD; }, origin],
    ['a network hostname', () => {}, 'http://console.example.test:3005'],
])('rejects quick sign-in in %s before contacting IAM', async (_case, configure, target) => {
    const iam = jest.spyOn(globalThis, 'fetch');
    configure();
    expect((await quickSignIn(target)).status).toBe(404);
    expect(iam).not.toHaveBeenCalled();
});
