import { expect, test } from '@playwright/test';
import { fixtureItem, fixtureLogin, fixtureOrigin } from './fixtures/qualification';

test.skip(!process.env.CONSOLE_QUALIFICATION_ORIGIN, 'Requires the fixture-backed production artifact');

const variants = [
    { name: 'Start', origin: process.env.CONSOLE_QUALIFICATION_ORIGIN, unmanaged: process.env.CONSOLE_UNMANAGED_QUALIFICATION_ORIGIN },
    { name: 'Next baseline', normalizesLoopback: true, origin: process.env.CONSOLE_BASELINE_CONTRACT_ORIGIN, unmanaged: process.env.CONSOLE_UNMANAGED_BASELINE_ORIGIN },
].filter(({ origin }) => origin);

test('embeds the managed launch ID in an uncached Start document', async ({ request }) => {
    const document = await request.get(`${fixtureOrigin()}/login`);
    expect(await document.text()).toContain('name="wahb-runtime-id" content="fixture-launch"');
    expect(document.headers()['cache-control']).toContain('no-store');
});

test('serves compressed production JavaScript when the browser accepts it', async ({ request }) => {
    const origin = fixtureOrigin();
    const html = await (await request.get(`${origin}/login`)).text();
    const path = html.match(/\b(?:src|href)="(\/assets\/[^" ]+\.js)"/)?.[1];
    expect(path).toBeDefined();
    const asset = await request.get(origin + path, { headers: { 'accept-encoding': 'gzip' } });
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-encoding']).toBe('gzip');
    expect(asset.headers().vary.toLowerCase()).toContain('accept-encoding');
});

test('ignores forwarded origins supplied by a direct client', async ({ context }) => {
    const origin = fixtureOrigin();
    const cookie = await fixtureLogin(context, origin);
    const result = await context.request.post(`${origin}/api/system-health/restart`, {
        headers: {
            cookie, origin: 'https://other.test', 'x-wahb-runtime-id': 'fixture-launch',
            'x-forwarded-host': 'other.test', 'x-forwarded-proto': 'https',
        },
        data: {},
    });
    expect(result.status()).toBe(403);
});

test('rejects unsupported API methods before falling through to a page', async ({ context }) => {
    const origin = fixtureOrigin();
    const cookie = await fixtureLogin(context, origin);
    const result = await context.request.fetch(`${origin}/api/cms/admin/qualification/wire`, {
        method: 'TRACE', headers: { cookie, origin, 'x-wahb-runtime-id': 'fixture-launch' },
    });
    expect(result.status()).toBe(400);
    expect(await result.body()).toHaveLength(0);
});

for (const variant of variants) {
    test(`${variant.name} preserves independent IAM cookies and managed gates`, async ({ context, request }) => {
        const origin = fixtureOrigin(variant.origin);
        // NextURL normalizes numeric loopback to localhost in its origin check.
        const requestOrigin = variant.normalizesLoopback ? origin.replace('127.0.0.1', 'localhost') : origin;

        const login = await request.post(`${origin}/api/auth/login`, {
            headers: { origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch' },
            data: { email: 'operator@example.test', password: 'fixture-only' },
        });
        expect(login.status()).toBe(200);
        const cookies = login.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie');
        expect(cookies).toHaveLength(4);
        expect(cookies.every(({ value }) => ['HttpOnly', 'Secure', 'SameSite=Lax'].every((flag) => value.toLowerCase().includes(flag.toLowerCase())))).toBe(true);
        const cookie = await fixtureLogin(context, origin, requestOrigin);

        const api = context.request;
        expect((await api.get(`${origin}/api/auth/me`, { headers: { cookie } })).status()).toBe(200);
        const old = await api.get(`${origin}/api/auth/me`, { headers: { cookie, 'x-wahb-runtime-id': 'old-launch' } });
        expect(old.status()).toBe(409);
        expect(await old.json()).toMatchObject({ code: 'runtime_changed' });
        expect((await api.post(`${origin}/api/system-health/restart`, {
            headers: { origin: 'http://other.test', 'x-wahb-runtime-id': 'old-launch' },
            data: { service: 'cms' },
        })).status()).toBe(403);

        const refreshed = await api.post(`${origin}/api/auth/refresh`, {
            headers: { cookie, origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch' },
        });
        expect(refreshed.status()).toBe(200);
        expect(refreshed.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie')).toHaveLength(4);
        const logout = await api.post(`${origin}/api/auth/logout`, {
            headers: { cookie, origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch' },
        });
        expect(logout.status()).toBe(200);
        expect(logout.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie')).toHaveLength(4);
        expect((await api.get(`${origin}/api/auth/me`)).status()).toBe(401);
    });

    test(`${variant.name} serves the API inventory and keeps catch-all query and auth forwarding`, async ({ context }) => {
        const origin = fixtureOrigin(variant.origin);
        // NextURL normalizes numeric loopback to localhost in its origin check.
        const requestOrigin = variant.normalizesLoopback ? origin.replace('127.0.0.1', 'localhost') : origin;
        const cookie = await fixtureLogin(context, origin, requestOrigin);
        for (const service of ['cms', 'iam', 'aggregation']) {
            const result = await context.request.get(`${origin}/api/${service}/admin/qualification/echo?q=a&q=b`, { headers: { cookie } });
            expect(result.status()).toBe(200);
            expect(await result.json()).toEqual({ path: '/admin/qualification/echo?q=a&q=b', authorization: 'Bearer fixture-access', cookie: null });
        }
        for (const [path, status] of [
            ['/api/system-health', 200],
            ['/api/ai-metrics', 200],
            ['/api/database-migrations/actions', 200],
            ['/api/database-migrations/programs', 200],
            ['/api/database-migrations/status', 200],
            ['/api/local-environments/unsupported', 404],
            [`/api/operator/investigations/${fixtureItem}/events?after=4`, 200],
        ] as const) {
            expect((await context.request.get(origin + path, { headers: { cookie } })).status(), path).toBe(status);
        }
        for (const [path, status] of [
            ['/api/system-health/migrations', 409],
            ['/api/system-health/restart', 400],
        ] as const) {
            const result = await context.request.post(origin + path, { headers: { cookie, origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch' }, data: {} });
            expect(result.status(), path).toBe(status);
        }
    });

    test(`${variant.name} forwards only a current reviewed request to the owner`, async ({ context }) => {
        const origin = fixtureOrigin(variant.origin);
        const requestOrigin = variant.normalizesLoopback ? origin.replace('127.0.0.1', 'localhost') : origin;
        const cookie = await fixtureLogin(context, origin, requestOrigin);
        const data = { plan_id: fixtureItem, digest: 'a'.repeat(64) };
        const request = context.request;
        const attempts = async () => {
            const result = await request.get(`${origin}/api/cms/admin/qualification/upgrade-attempts`, { headers: { cookie } });
            expect(result.status()).toBe(200);
            return result.json();
        };
        const before = await attempts();
        const submit = (runtime: string, originHeader: string, body: object) => request.post(`${origin}/api/local-environments/upgrade`, {
            headers: { cookie, origin: originHeader, 'x-wahb-runtime-id': runtime },
            data: body,
        });

        expect((await submit('old-launch', requestOrigin, data)).status()).toBe(409);
        expect((await submit('fixture-launch', 'http://other.test', data)).status()).toBe(403);
        expect((await submit('fixture-launch', requestOrigin, { ...data, digest: 'invalid' })).status()).toBe(400);
        expect(await attempts()).toEqual(before);

        const reviewed = await submit('fixture-launch', requestOrigin, data);
        expect(reviewed.status()).toBe(409);
        expect(await reviewed.json()).toEqual({ message: 'Qualification fixtures refuse owner effects' });
        expect(await attempts()).toEqual([...before, { body: data, machineAuthorized: true, actorAuthorized: true, runtime: 'fixture-launch' }]);
    });

    test(`${variant.name} preserves binary and bodyless HTTP responses`, async ({ context }) => {
        const origin = fixtureOrigin(variant.origin);
        const requestOrigin = variant.normalizesLoopback ? origin.replace('127.0.0.1', 'localhost') : origin;
        const cookie = await fixtureLogin(context, origin, requestOrigin);
        const path = `${origin}/api/cms/admin/qualification/wire`;
        const data = Buffer.from([0, 255, 1, 128, 13, 10]);
        const result = await context.request.post(path, {
            headers: { cookie, origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch', 'content-type': 'application/octet-stream' },
            data,
        });
        expect(result.status()).toBe(201);
        expect(result.headers()['content-type']).toBe('application/octet-stream');
        expect(result.headers()['content-encoding']).toBeUndefined();
        expect(await result.body()).toEqual(data);
        if (variant.name === 'Start') expect(result.headers()['cache-control']).toBe('private, no-store');
        for (const status of [204, 205, 304]) {
            const result = await context.request.get(`${path}?status=${status}`, { headers: { cookie } });
            expect(result.status()).toBe(status);
            expect(await result.body()).toHaveLength(0);
        }
        const options = await context.request.fetch(path, { method: 'OPTIONS', headers: { cookie } });
        expect(options.status()).toBe(204);
        expect(options.headers()['x-fixture-method']).toBe('OPTIONS');
        const head = await context.request.head(path, { headers: { cookie } });
        expect(head.status()).toBe(204);
        expect(await head.body()).toHaveLength(0);

        const auth = `${origin}/api/auth/me`;
        const authOptions = await context.request.fetch(auth, { method: 'OPTIONS', headers: { cookie } });
        expect(authOptions.status()).toBe(204);
        expect(authOptions.headers().allow).toBe('GET, HEAD, OPTIONS');
        const unsupported = await context.request.put(auth, {
            headers: { cookie, origin: requestOrigin, 'x-wahb-runtime-id': 'fixture-launch' },
        });
        expect(unsupported.status()).toBe(405);
    });

    test(`${variant.name} keeps unmanaged sessions independent of a launch ID`, async ({ request }) => {
        test.skip(!variant.unmanaged, 'Requires the unmanaged fixture server');
        const origin = fixtureOrigin(variant.unmanaged);
        const login = await request.post(`${origin}/api/auth/login`, {
            headers: { origin },
            data: { email: 'operator@example.test', password: 'fixture-only' },
        });
        expect(login.status()).toBe(200);
        const cookies = login.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie');
        expect(cookies).toHaveLength(3);
        const cookie = cookies.map(({ value }) => value.split(';', 1)[0]).join('; ');
        expect((await request.get(`${origin}/api/auth/me`, { headers: { cookie } })).status()).toBe(200);
        const logout = await request.post(`${origin}/api/auth/logout`, { headers: { cookie, origin } });
        expect(logout.status()).toBe(200);
        expect(logout.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie')).toHaveLength(4);
    });
}
