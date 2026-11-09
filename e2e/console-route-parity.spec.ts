import { expect, test } from '@playwright/test';
import { fixtureItem, fixtureLogin, fixtureOrigin, studioUrl } from './fixtures/qualification';

test.skip(!process.env.CONSOLE_QUALIFICATION_ORIGIN, 'Requires the fixture-backed production artifact');

test('redirects a signed-out deep link before requesting private content', async ({ page }) => {
    const origin = fixtureOrigin();
    const contentRequests: string[] = [];
    page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith('/api/cms/')) contentRequests.push(path);
    });
    await page.goto(origin + '/platform/news?view=library');
    await expect(page).toHaveURL(origin + '/login');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(contentRequests).toEqual([]);
});

test('guides quick sign-in when the browser has no saved credentials', async ({ page }) => {
    const origin = fixtureOrigin();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'credentials', { value: { get: async () => null } });
    });
    await page.goto(origin + '/login');
    const shortcut = page.getByRole('button', { name: 'Quick sign in' });
    await shortcut.click();
    await expect(page.getByRole('status')).toHaveText(/Enter your Console credentials/);
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByText('Please enter a valid email address')).toHaveCount(0);
    await expect(page.getByText('Password is required')).toHaveCount(0);

    await page.getByLabel('Email').fill('operator@example.test');
    await shortcut.click();
    await expect(page.getByLabel('Password')).toBeFocused();
    await expect(page.getByText('Password is required')).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Password is required')).toBeVisible();
});

test('signs in through the logo using the credentials in the form', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    await page.goto(origin + '/login');
    const shortcut = page.getByRole('button', { name: 'Quick sign in' });

    // Simulate a password manager populating the inputs without input events.
    await page.getByLabel('Email').evaluate((input: HTMLInputElement) => { input.value = 'operator@example.test'; });
    await page.getByLabel('Password').evaluate((input: HTMLInputElement) => { input.value = 'fixture-only'; });
    await shortcut.click();
    await expect(page).toHaveURL(origin + '/');
    await expect(page.getByRole('link', { name: 'News', exact: true }).first()).toBeVisible();
});

test('uses a browser-selected saved login when the form is empty', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    await page.addInitScript(() => {
        Object.defineProperty(window, 'PasswordCredential', { value: class {} });
        Object.defineProperty(navigator, 'credentials', {
            value: { get: async ({ password }: { password?: boolean }) => password
                ? { type: 'password', id: 'operator@example.test', password: 'fixture-only' }
                : null },
        });
    });
    await page.goto(origin + '/login');
    await page.getByRole('button', { name: 'Quick sign in' }).click();
    await expect(page).toHaveURL(origin + '/');
    await expect(page.getByRole('link', { name: 'News', exact: true }).first()).toBeVisible();
});

test('preserves direct URLs and redirect aliases', async ({ request }) => {
    const origin = fixtureOrigin();
    const views = [
        '/', '/login', '/admin/users',
        ...[
            'content', `content/${fixtureItem}`, 'database-migrations', 'economics', 'enrichment',
            'feed-integrity', 'intelligence', 'intelligence/analytics', 'intelligence/embeddings',
            'intelligence/flags', 'intelligence/preview', 'media', 'media/atomization', 'media/circulation',
            'media/redundancy', 'media/sources', 'media/sources/new', 'moderation', 'news', 'news/circulation',
            'news/finding', 'news/sources', 'operations', 'operator', 'pipeline', 'real-experience', 'recovery',
            'retention', 'sources', `sources/${fixtureItem}`, 'sources/new', 'storage', 'system-health', 'topics', 'workload',
        ].map((path) => `/platform/${path}`),
    ];
    const aliases = {
        '/admin': '/admin/users',
        '/platform': '/',
        '/platform/feed-recovery': '/platform/recovery?view=feed-recovery',
        '/platform/intelligence/media-value': '/platform/intelligence',
        '/platform/intelligence/ranking': '/platform/intelligence',
        '/platform/media/finding': '/platform/media/sources?tab=finding',
        '/platform/media-studio': '/platform/media/atomization?tab=studio',
        [`/platform/media-studio/${fixtureItem}`]: studioUrl,
        [`/platform/media/${fixtureItem}`]: studioUrl,
        '/platform/quality': '/platform/storage?section=quality',
    };
    expect(views.length + Object.keys(aliases).length).toBe(48);
    for (const path of views) expect((await request.get(origin + path)).status(), path).toBe(200);
    for (const [path, to] of Object.entries(aliases)) {
        const result = await request.get(origin + path, { maxRedirects: 0 });
        expect(result.status(), path).toBe(307);
        expect(new URL(result.headers().location, origin).href).toBe(origin + to);
    }
    const trailingSlash = await request.get(`${origin}/platform/news/?view=topics&tag=a%2Bb&tag=c`, { maxRedirects: 0 });
    expect(trailingSlash.status()).toBe(307);
    expect(trailingSlash.headers().location).toBe('/platform/news?view=topics&tag=a%2Bb&tag=c');
    const encodedAlias = await request.get(`${origin}/platform/media-studio/episode%2F%25%20title`, { maxRedirects: 0 });
    expect(encodedAlias.status()).toBe(307);
    expect(new URL(encodedAlias.headers().location, origin).searchParams.get('item')).toBe('episode/% title');
    expect((await request.get(origin + '/platform/route-does-not-exist')).status()).toBe(404);
});

test('navigates between News and Media Studio without replacing the document', async ({ context, page }) => {
    const origin = fixtureOrigin();
    if (process.env.DEBUG_CONSOLE_QUALIFICATION) {
        page.on('console', (message) => {
            if (message.type() === 'error') console.log(message.text());
        });
        page.on('pageerror', (error) => console.log(error.stack));
    }
    await fixtureLogin(context, origin);
    await page.goto(origin + '/platform/news');
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await page.evaluate(() => document.documentElement.dataset.fixtureDocument = 'preserved');
    await page.getByRole('link', { name: 'Media Studio', exact: true }).first().click();
    await expect(page).toHaveURL(origin + '/platform/media/atomization');
    await expect(page.getByRole('heading', { name: 'Atomization workflow', exact: true })).toBeVisible();
    expect(await page.locator('html').getAttribute('data-fixture-document')).toBe('preserved');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Stories' }).click();
    await expect(page).toHaveURL(origin + '/platform/news?view=topics');
    await expect(page.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
});

test('preserves repeated query values in News and Media Studio bookmarks', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const news = `${origin}/platform/news?view=topics&view=library&tag=a%2Bb&tag=c#stories`;
    await page.goto(news);
    await expect(page.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(news);

    const studio = `${origin}${studioUrl}&item=older-bookmark`;
    await page.goto(studio);
    await expect(page.getByPlaceholder('Chapter title').first()).toHaveValue('Fixture chapter');
    await expect(page).toHaveURL(studio);
});

test('keeps System Health navigation visible while the Incidents panel loads', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.goto(origin + '/platform/system-health');
    const panelAsset = /\/assets\/system-autopilot-panel-[^/]+\.js$/;
    const assetGate = Promise.withResolvers<void>();
    await page.route(panelAsset, async (route) => {
        await assetGate.promise;
        await route.continue();
    });
    const incidents = page.getByRole('tab', { name: /Incidents & automation/ });
    try {
        await Promise.all([page.waitForRequest(panelAsset), incidents.click()]);
        await expect(incidents).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('heading', { name: 'System Health' })).toBeVisible();
    } finally {
        assetGate.resolve();
    }
});
