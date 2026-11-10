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
    await expect(page).toHaveURL(origin + '/login?returnTo=%2Fplatform%2Fnews%3Fview%3Dlibrary');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(contentRequests).toEqual([]);
});

test('disables local quick sign-in in the production build', async ({ page, request }) => {
    const origin = fixtureOrigin();
    await page.goto(origin + '/login');
    await expect(page.getByRole('button', { name: 'Quick sign in' })).toHaveCount(0);
    const response = await request.post(origin + '/api/auth/login', {
        headers: { origin, 'x-wahb-runtime-id': 'fixture-launch' },
        data: { mode: 'local-quick-sign-in' },
    });
    expect(response.status()).toBe(404);

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Password is required')).toBeVisible();
});

test('signs in with password manager autofill', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    await page.goto(origin + '/login');
    // Simulate a password manager populating the inputs without input events.
    await page.getByLabel('Email').evaluate((input: HTMLInputElement) => { input.value = 'operator@example.test'; });
    await page.getByLabel('Password', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'fixture-only'; });
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
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
    await expect(page.getByRole('tabpanel', { name: 'Stories' })).toBeVisible();
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
    const opener = page.getByRole('button', { name: 'Incident history', exact: true });
    await opener.click();
    const history = page.getByRole('dialog', { name: 'System Health incident history' });
    await expect(history).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(history).toBeHidden();
    await expect(opener).toBeFocused();
});

test('opens one named mobile navigation sheet and returns focus', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(origin + '/platform/news');
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Console navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Close/ })).toHaveCount(1);
    await drawer.getByRole('button', { name: 'Close navigation' }).click();
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
});

test('returns to a bookmarked page after sign-in', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    const target = '/platform/news?view=library#search';
    await page.goto(origin + target);
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('returnTo') === target);
    await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
    await page.getByLabel('Password', { exact: true }).fill('fixture-only');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(origin + target);
});

test('restores one expired session across tabs and clears it on sign-out', async ({ context, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await context.clearCookies({ name: 'console_access_token' });
    let refreshes = 0;
    context.on('request', (request) => { if (request.url().endsWith('/api/auth/refresh')) ++refreshes; });
    const tabs = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all(tabs.map((tab) => tab.goto(origin + '/platform/news')));
    await Promise.all(tabs.map((tab) => expect(tab.getByRole('heading', { name: 'News', exact: true })).toBeVisible()));
    expect(refreshes).toBe(1);
    await tabs[0].getByRole('button', { name: 'Account options' }).click();
    await tabs[0].getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(tabs[1]).toHaveURL((url) => url.pathname === '/login');
    expect((await context.cookies()).some((cookie) => cookie.name === 'console_refresh_token')).toBe(false);
});

test('allows session retry during an IAM outage', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.route('**/api/auth/me', (route) => route.fulfill({
        status: 503, json: { code: 'session_unavailable' },
    }), { times: 1 });
    await page.goto(origin + '/platform/news');
    await expect(page.getByRole('alert')).toContainText('couldn’t check your session');
    expect((await context.cookies()).some((cookie) => cookie.name === 'console_refresh_token')).toBe(true);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
});

test('enrolls and uses a passkey with a Chromium virtual authenticator', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'The virtual authenticator uses Chromium DevTools');
    const origin = fixtureOrigin().replace('127.0.0.1', 'localhost');
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
        protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
        hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
    } });
    await page.goto(origin + '/login');
    await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
    await page.getByLabel('Password', { exact: true }).fill('fixture-only');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('menuitem', { name: 'Passkeys' }).click();
    await page.getByRole('button', { name: 'Add a passkey' }).click();
    await page.getByLabel('Current password', { exact: true }).fill('fixture-only');
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByText(/Passkey added/)).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(origin + '/login');
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(origin + '/');
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('menuitem', { name: 'Passkeys' }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByLabel('Current password', { exact: true }).fill('fixture-only');
    await page.getByRole('button', { name: 'Remove passkey' }).click();
    await expect(page.getByText('You haven’t added a passkey.')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Account options' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(origin + '/login');
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page.getByRole('alert')).toContainText('Passkey sign-in didn’t complete');
    await page.evaluate(() => {
        navigator.credentials.get = async () => { throw new DOMException('Cancelled', 'NotAllowedError'); };
    });
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page.getByRole('alert')).toContainText('Passkey sign-in didn’t complete');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('uses the dedicated Console reset page and removes its token from the URL', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Fixture reset token is single use');
    const origin = fixtureOrigin().replace('127.0.0.1', 'localhost');
    await page.goto(origin + '/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('If an account matches that email');

    await page.goto(origin + '/reset-password#token=fixture-reset');
    await expect(page).toHaveURL(origin + '/reset-password');
    await page.getByLabel('New password', { exact: true }).fill('fixture-new-password');
    await page.getByLabel('Confirm new password', { exact: true }).fill('fixture-new-password');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('status')).toContainText('Your password was updated');
    await page.goto(origin + '/reset-password#token=fixture-reset');
    await page.getByLabel('New password', { exact: true }).fill('fixture-new-password');
    await page.getByLabel('Confirm new password', { exact: true }).fill('fixture-new-password');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('alert')).toContainText('invalid or expired');
});

test('renders mixed selection at full size in Users and News Sources', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const stamp = '2026-10-01T00:00:00Z';
    await page.route('**/api/**/iam/{roles,permissions}', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/**/iam/users', (route) => route.fulfill({ json: {
        data: ['alpha', 'beta'].map((id) => ({
            id, email: `${id}@example.test`, role: 'admin', permissions: [], created_at: stamp, updated_at: stamp,
        })),
    } }));
    await page.route('**/api/**/admin/discovery/profiles', (route) => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/**/admin/discovery/sources*', (route) => route.fulfill({ json: {
        data: ['Alpha', 'Beta'].map((name) => ({
            id: name, name, type: 'RSS', is_active: false, items_count: 0, feed_url: `https://example.test/${name}`,
        })),
    } }));
    for (const surface of [
        { path: '/admin/users', row: 'Select alpha@example.test', all: /Select all users/ },
        { path: '/platform/news/sources', row: 'Select Alpha', all: /Select all 2/ },
    ]) {
        await page.goto(origin + surface.path);
        const row = page.getByRole('checkbox', { name: surface.row, exact: true });
        const all = page.getByRole('checkbox', { name: surface.all });
        await expect(all).toHaveAttribute('aria-checked', 'false');
        await row.click();
        await expect(all).toHaveAttribute('aria-checked', 'mixed');
        const box = await all.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(16);
        expect(box?.height).toBeGreaterThanOrEqual(16);
        await all.focus();
        await page.keyboard.press('Space');
        await expect(all).toBeChecked();
    }
});

test('keeps News and Studio actions within the 320px viewport', async ({ context, page }, info) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.setViewportSize({ width: 320, height: 800 });
    const fits = async (name: string) => {
        const button = page.getByRole('button', { name, exact: true }).first();
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    };
    const noMainOverflow = async () => {
        const main = page.locator('#console-scroll-region');
        const widths = await main.evaluate((node) => ({ content: node.scrollWidth, visible: node.clientWidth }));
        expect(widths.content).toBeLessThanOrEqual(widths.visible + 1);
    };
    await page.goto(origin + '/platform/news?view=topics');
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await fits('Add news');
    await fits('Auto-stories');
    await noMainOverflow();
    await page.screenshot({ path: info.outputPath('news-320.png') });
    await page.getByRole('tab', { name: 'Library' }).click();
    await expect(page.getByText('Fixture News article', { exact: true }).first()).toBeVisible();
    await noMainOverflow();
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Overview' })).toBeVisible();
    await noMainOverflow();

    await page.goto(origin + studioUrl);
    await expect(page.getByPlaceholder('Chapter title').first()).toHaveValue('Fixture chapter');
    await fits('Add at playhead');
    await fits('Save transcript');
    await noMainOverflow();
    await page.getByPlaceholder('Chapter title').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('studio-320.png') });
});

test('keeps the Overview summary in view when the attention inbox is busy', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const title = 'Active media sources have no items eligible for the Pods feed. Check source readiness and the publication evidence.';
    await page.route('**/api/cms/admin/ops/status', route => route.fulfill({ json: { data: {
        as_of: new Date().toISOString(), headline: 'attention', summary: '26 fleet items need attention · 1 member stalled or stuck · 1 lane lacks liveness evidence.',
        fleet: [], adapter_errors: [], complete: true,
    } } }));
    await page.route('**/api/cms/admin/ops/attention?*', route => {
        const limit = new URL(route.request().url()).searchParams.get('limit');
        expect(limit).toBe('1');
        return route.fulfill({ json: { data: {
            as_of: new Date().toISOString(), total: 26, limit: 1, offset: 0, has_more: true, complete: true, adapter_errors: [],
            items: [{ key: 'fixture-alert', title, severity: 'major', href: '/platform/feed-integrity', snoozed: false }],
        } } });
    });

    await page.goto(origin + '/');
    const attention = page.getByRole('region', { name: 'Needs attention' });
    await expect(attention.getByText('26 open')).toBeVisible();
    await expect(attention.getByRole('link', { name: title })).toHaveAttribute('href', '/platform/feed-integrity');
    await expect(attention.getByRole('link', { name: 'Open inbox' })).toHaveAttribute('href', '/platform/operations#ops-attention');
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole('heading', { name: 'System status' })).toBeInViewport();
        await expect(page.getByRole('heading', { name: 'Content inventory' })).toBeInViewport();
        expect((await attention.boundingBox())?.height).toBeLessThan(130);
        expect(await page.locator('main').evaluate(main => main.scrollWidth)).toBeLessThanOrEqual(width);
    }
});

test('opens an exact story from Find & Jump and restores the previous route', async ({ context, page }) => {
    const origin = fixtureOrigin();
    const story = '9709bf32-a4dc-4786-8708-4e956991cae3';
    await fixtureLogin(context, origin);
    const lookups: string[] = [];
    await page.route('**/api/cms/admin/sources/lookup?*', route => {
        lookups.push('source');
        return route.fulfill({ json: { items: [] } });
    });
    await page.route('**/api/cms/admin/content/stories?*', route => {
        const search = new URL(route.request().url()).searchParams.get('search');
        return route.fulfill({ json: { data: search ? [{ id: story, label: 'Fixture searchable story' }] : [], total: search ? 1 : 0 } });
    });
    await page.route('**/api/cms/admin/stories/' + story, route => route.fulfill({ json: { id: story, label: 'Fixture searchable story' } }));
    const from = origin + '/platform/news?view=library';
    await page.goto(from);
    const trigger = page.getByRole('button', { name: 'Find & Jump' });
    await expect(trigger).toBeVisible();
    expect(lookups).toHaveLength(0);
    await trigger.click();
    const input = page.getByRole('textbox', { name: 'Search Console' });
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await input.fill('searchable story');
    await page.getByRole('link', { name: /Fixture searchable story/ }).click();
    await expect(page).toHaveURL(origin + '/platform/news?view=topics&story=' + story);
    await expect(page.getByRole('heading', { name: 'Fixture searchable story' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(from);
    await page.goto(origin + '/platform/news?view=topics&story=' + story);
    await expect(page.getByRole('heading', { name: 'Fixture searchable story' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fixture searchable story' })).toBeVisible();
});

test('reopens a paged moderation case and reconciles a concurrent decision', async ({ context, page }) => {
    const origin = fixtureOrigin();
    const first = '4bd5b554-de0b-4226-b23a-1dcedf96ad9f';
    const second = '3c6508fd-a5ea-47ea-8815-71b8431f9a85';
    await fixtureLogin(context, origin);
    let reviewed = false;
    const decisions: unknown[] = [];
    const report = (id: string) => ({
        id, target_id: fixtureItem, target_type: 'comment', reason: 'fixture_reason', author_suspended: false,
        detail: id === first ? 'First page report' : 'Second page report', created_at: '2026-09-13T12:00:00Z',
        status: reviewed && id === second ? 'resolved' : 'open',
    });
    await page.route('**/api/cms/admin/moderation/reports?*', route => {
        const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
        return route.fulfill({ json: { data: [report(pageNumber === 2 ? second : first)], page: pageNumber, limit: 1, total: 2, total_pages: 2 } });
    });
    await page.route('**/api/cms/admin/moderation/reports/' + second, route => route.fulfill({ json: { data: {
        report: report(second), target_available: true, comment_text: 'Fixture reported comment', parent_id: fixtureItem, parent_title: 'Fixture parent',
    } } }));
    await page.route('**/api/cms/admin/moderation/reports/' + second + '/resolve', route => {
        decisions.push(route.request().postDataJSON());
        reviewed = true;
        return route.fulfill({ status: 409, json: { message: 'Report already reviewed' } });
    });

    await page.goto(origin + '/platform/moderation');
    await expect(page.getByText('First page report')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(page.getByText('Second page report')).toBeVisible();
    await page.getByRole('button', { name: 'Review case' }).click();
    const selected = origin + '/platform/moderation?status=open&page=2&case=' + second;
    await expect(page).toHaveURL(selected);
    await expect(page.getByText('Fixture reported comment')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(selected);
    await expect(page.getByRole('link', { name: 'Fixture parent' })).toBeVisible();
    const resolve = page.getByRole('button', { name: 'Resolve report' });
    await expect(resolve).toBeDisabled();
    await page.getByRole('textbox', { name: 'Decision reason' }).fill('Reviewed the reported comment');
    await resolve.click();
    await expect(page.getByText('Report status: resolved')).toBeVisible();
    await expect(resolve).toHaveCount(0);
    expect(decisions).toEqual([{ status: 'resolved', reason: 'Reviewed the reported comment' }]);
});
