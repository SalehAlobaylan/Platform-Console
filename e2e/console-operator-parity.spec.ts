import { expect, test } from '@playwright/test';
import { fixtureItem, fixtureLogin, fixtureOrigin, studioUrl } from './fixtures/qualification';

test.skip(!process.env.CONSOLE_QUALIFICATION_ORIGIN, 'Requires the fixture-backed production artifact');

test('guards an unsaved Studio draft once and lets the operator stay or leave', async ({ context, page }) => {
    const origin = fixtureOrigin();
    if (process.env.DEBUG_CONSOLE_QUALIFICATION) {
        page.on('console', (message) => {
            if (message.type() === 'error') console.log(message.text());
        });
        page.on('pageerror', (error) => console.log(error.stack));
    }
    await fixtureLogin(context, origin);
    await page.goto(origin + studioUrl);
    const chapter = page.getByPlaceholder('Chapter title').first();
    await expect(chapter).toHaveValue('Fixture chapter');
    await chapter.fill('An unsaved chapter');
    const news = page.getByRole('link', { name: 'News', exact: true }).first();
    let prompts = 0;
    page.once('dialog', async (dialog) => {
        prompts++;
        await dialog.dismiss();
    });
    await news.click();
    await expect.poll(() => prompts).toBe(1);
    await expect(chapter).toHaveValue('An unsaved chapter');
    await expect(page).toHaveURL(origin + studioUrl);
    page.once('dialog', async (dialog) => {
        prompts++;
        await dialog.accept();
    });
    await news.click();
    await expect(page).toHaveURL(origin + '/platform/news');
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    expect(prompts).toBe(2);
});

test('restores Console location, nested scroll, and focus through the Operator shortcut', async ({ context, page }) => {
    const origin = fixtureOrigin();
    const from = origin + '/platform/news?view=topics#qualification';
    await fixtureLogin(context, origin);
    await page.setViewportSize({ width: 1440, height: 390 });
    await page.goto(from);
    await expect(page.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
    const scroll = page.locator('#console-scroll-region');
    await scroll.hover();
    await page.mouse.wheel(0, 150);
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const position = await scroll.evaluate((element) => element.scrollTop);

    await page.keyboard.press('Control+j');
    await expect(page).toHaveURL((url) => url.pathname === '/platform/operator');
    await expect(page.locator('[data-workspace="operator"]')).toBeFocused();
    await page.keyboard.press('Control+j');
    await expect(page).toHaveURL(from);
    await expect(page.locator('[data-workspace="console"]')).toBeFocused();
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(position);
});

test('cancelling browser Back keeps the draft and the history position', async ({ context, page }) => {
    const origin = fixtureOrigin();
    const news = origin + '/platform/news';
    await fixtureLogin(context, origin);
    await page.goto(news);
    await page.getByRole('link', { name: 'Media Studio', exact: true }).first().click();
    await page.getByText('Fixture Studio episode', { exact: true }).first().click();
    const beforeStudio = page.url();
    await page.getByRole('link', { name: 'Open episode', exact: true }).click();
    const chapter = page.getByPlaceholder('Chapter title').first();
    await expect(chapter).toHaveValue('Fixture chapter');
    await chapter.fill('An unsaved chapter');
    const draft = page.url();

    const dismissed = page.waitForEvent('dialog').then((dialog) => dialog.dismiss());
    await page.evaluate(() => history.back());
    await dismissed;
    await expect(page).toHaveURL(draft);
    await expect(chapter).toHaveValue('An unsaved chapter');

    const accepted = page.waitForEvent('dialog').then((dialog) => dialog.accept());
    await page.evaluate(() => history.back());
    await accepted;
    await expect(page).toHaveURL(beforeStudio);
    await page.goForward();
    await expect(page).toHaveURL(draft);
    await expect(chapter).toHaveValue('Fixture chapter');
});

test('restores an unsent Operator draft after a workspace round trip', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.goto(origin + '/platform/news?view=library');
    await page.getByRole('link', { name: 'Operator', exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.has('draft'));
    const draft = page.locator('#operator-composer-input');
    const text = 'Unsent routing smoke draft';
    await draft.fill(text);
    await expect(page.getByRole('tab', { name: /Unsent routing smoke draft/ })).toBeVisible();
    await page.getByRole('link', { name: 'Console', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('link', { name: 'Operator', exact: true }).click();
    await expect(draft).toHaveValue(text);
    await page.reload();
    await expect(draft).toHaveValue(text);
});

test('keeps drafts and late private responses isolated when switching accounts', async ({ context, page, browserName }) => {
    test.skip(browserName === 'webkit', 'The fixture HTTP origin cannot store Secure cookies in WebKit');
    const origin = fixtureOrigin();
    const library = origin + '/platform/news?view=library';
    const firstArticle = 'Fixture News article';
    const secondArticle = 'Reviewer-only fixture article';
    const draftText = 'First account private draft';
    await fixtureLogin(context, origin);
    await page.goto(library);
    await expect(page.getByText(firstArticle, { exact: true }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Operator', exact: true }).click();
    const composer = page.locator('#operator-composer-input');
    await composer.fill(draftText);
    await expect(page.getByRole('tab', { name: /First account private draft/ })).toBeVisible();
    await page.getByRole('link', { name: 'Console', exact: true }).click();
    await expect(page).toHaveURL(library);
    await page.evaluate(() => { document.documentElement.dataset.fixtureAccount = 'first'; });

    const oldRead = Promise.withResolvers<string>();
    const release = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    await context.route((url) => url.pathname === '/api/cms/admin/content' && url.searchParams.get('search') === 'held response', async (route) => {
        try {
            const response = await route.fetch();
            oldRead.resolve((await response.json()).data[0].title);
            await release.promise;
            // A full document change can cancel this response before delivery.
            await route.fulfill({ response }).catch(() => {});
        } catch (error) {
            oldRead.reject(error);
        } finally {
            settled.resolve();
        }
    }, { times: 1 });

    try {
        await page.getByPlaceholder('Search headlines…').fill('held response');
        expect(await oldRead.promise).toBe(firstArticle);
        await page.getByRole('button', { name: 'Account options' }).click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
        await expect(page).toHaveURL(origin + '/login');
        await expect(page.locator('html')).not.toHaveAttribute('data-fixture-account', 'first');
        await expect(page.getByRole('button', { name: 'Quick sign in' })).toBeEnabled();
        await page.getByLabel('Email').fill('reviewer@example.test');
        await page.getByLabel('Password').fill('fixture-only');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page).toHaveURL(origin + '/');
        await page.goto(library);
        await expect(page.getByText(secondArticle, { exact: true }).first()).toBeVisible();

        release.resolve();
        await settled.promise;
        await expect(page.getByText(firstArticle, { exact: true })).toHaveCount(0);
        await page.getByRole('link', { name: 'Operator', exact: true }).click();
        await expect(composer).toHaveValue('');
        await expect(page.getByRole('tab', { name: /First account private draft/ })).toHaveCount(0);
    } finally {
        release.resolve();
    }
});

test('rejects a stale tab after another tab signs into the new launch', async ({ context, page }) => {
    test.skip(!process.env.CONSOLE_RESTART_QUALIFICATION_ORIGIN, 'Requires the two-launch fixture');
    const origin = fixtureOrigin(process.env.CONSOLE_RESTART_QUALIFICATION_ORIGIN);
    expect((await context.request.post(`${origin}/__fixture/before`)).ok()).toBe(true);
    await fixtureLogin(context, origin);
    await page.goto(origin + '/platform/news');
    await expect(page.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await expect(page.locator('meta[name="wahb-runtime-id"]')).toHaveAttribute('content', 'fixture-launch');

    const newTab = await context.newPage();
    expect((await context.request.post(`${origin}/__fixture/after`)).ok()).toBe(true);
    const cookie = await fixtureLogin(context, origin, origin, 'fixture-restarted');
    await newTab.goto(origin + '/platform/news');
    await expect(newTab.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
    await expect(newTab.locator('meta[name="wahb-runtime-id"]')).toHaveAttribute('content', 'fixture-restarted');
    const attempts = async () => (await context.request.get(`${origin}/api/cms/admin/qualification/upgrade-attempts`, { headers: { cookie } })).json();
    const before = await attempts();

    const rejected = page.waitForResponse((response) => response.url().endsWith('/api/local-environments/upgrade'));
    await page.evaluate((planId) => {
        void fetch('/api/local-environments/upgrade', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ plan_id: planId, digest: 'a'.repeat(64) }),
        });
    }, fixtureItem);
    const response = await rejected;
    expect(response.status()).toBe(409);
    expect(response.request().headers()['x-wahb-runtime-id']).toBe('fixture-launch');
    await expect(page).toHaveURL(origin + '/login');
    expect(await attempts()).toEqual(before);
    await expect(newTab.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
});
