import { expect, type BrowserContext } from '@playwright/test';

export const fixtureItem = '11111111-1111-4111-8111-111111111111';
export const studioUrl = `/platform/media/atomization?tab=studio&item=${fixtureItem}`;

export function fixtureOrigin(value = process.env.CONSOLE_QUALIFICATION_ORIGIN) {
    if (!value) throw new Error('Run the Console qualification harness first');
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== value) {
        throw new Error('Console fixtures require an explicit loopback origin');
    }
    return url.origin;
}

export async function fixtureLogin(context: BrowserContext, origin = fixtureOrigin(), requestOrigin = origin, runtime = 'fixture-launch') {
    const response = await context.request.post(`${origin}/api/auth/login`, {
        headers: { origin: requestOrigin, 'x-wahb-runtime-id': runtime },
        data: { email: 'operator@example.test', password: 'fixture-only' },
    });
    expect(response.status()).toBe(200);
    const cookies = response.headersArray()
        .filter(({ name }) => name.toLowerCase() === 'set-cookie')
        .map(({ value }) => value.split(';', 1)[0]);
    // WebKit declines Secure cookies on the fixture's HTTP origin. The raw
    // contract spec independently verifies the actual production flags.
    if (context.browser()?.browserType().name() === 'webkit') {
        await context.addCookies(cookies.map((cookie) => {
            const separator = cookie.indexOf('=');
            return {
                url: origin, name: cookie.slice(0, separator), value: cookie.slice(separator + 1),
                httpOnly: true, secure: false, sameSite: 'Lax' as const,
            };
        }));
    }
    return cookies.join('; ');
}
