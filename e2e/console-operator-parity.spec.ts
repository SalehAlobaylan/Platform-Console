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
        await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
        await page.getByLabel('Email').fill('reviewer@example.test');
        await page.getByLabel('Password', { exact: true }).fill('fixture-only');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page).toHaveURL(origin + '/');
        await page.getByRole('link', { name: 'News', exact: true }).first().click();
        await page.getByRole('tab', { name: 'Library', exact: true }).click();
        await expect(page).toHaveURL(library);
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
    await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('reason') === 'runtime_changed');
    expect(await attempts()).toEqual(before);
    await expect(newTab.getByRole('heading', { name: 'News', exact: true })).toBeVisible();
});

test('keeps keyboard-driven account and Passkeys overlays focused and inside the viewport', async ({ context, page }, info) => {
    const origin = fixtureOrigin().replace('127.0.0.1', 'localhost');
    await fixtureLogin(context, origin);
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.goto(origin + '/platform/operator');
    const account = page.getByRole('button', { name: 'Account options' });
    await page.setViewportSize({ width: 1440, height: 800 });
    await account.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('dir', 'ltr');
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();

    const intent = page.getByRole('combobox', { name: 'Response style' });
    await expect(intent).toContainText('Ask');
    await intent.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: /^Ask/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Investigate' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(intent).toContainText('Investigate');
    await expect(intent).toBeFocused();

    const chat = page.getByRole('button', { name: 'Chat options' });
    await chat.click();
    await page.getByRole('menuitem', { name: 'العربية' }).click();
    const arabicAccount = page.getByRole('button', { name: 'خيارات الحساب' });
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await arabicAccount.click();
        await expect(menu).toHaveAttribute('dir', 'rtl');
        const box = await menu.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await page.screenshot({ path: info.outputPath(`account-rtl-${width}.png`) });
        await page.keyboard.press('Escape');
        await expect(arabicAccount).toBeFocused();
        if (width === 320) {
            await arabicAccount.click();
            await page.getByRole('menuitem', { name: 'المظهر الداكن' }).click();
            await expect(page.locator('html')).toHaveClass(/dark/);
        }
    }
    await page.keyboard.press('ArrowDown');
    await page.getByRole('menuitem', { name: 'مفاتيح المرور' }).click();
    const dialog = page.getByRole('dialog', { name: 'Passkeys' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('dir', 'rtl');
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(arabicAccount).toBeFocused();
});

test('keeps a failed sign-out visible and allows only one pending request', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    let attempts = 0;
    const finish = Promise.withResolvers<void>();
    await page.route('**/api/auth/logout', async (route) => {
        attempts++;
        await finish.promise;
        await route.fulfill({ status: 503, json: { message: 'Fixture IAM unavailable' } });
    });
    await page.goto(origin + '/platform/news');
    await page.getByRole('button', { name: 'Account options' }).click();
    const menu = page.getByRole('menu');
    const signOut = menu.getByRole('menuitem', { name: 'Sign out' });
    try {
        await signOut.click();
        await expect(signOut).toBeDisabled();
        await page.keyboard.press('Enter');
        await expect.poll(() => attempts).toBe(1);
    } finally {
        finish.resolve();
    }
    await expect(menu.getByRole('alert')).toHaveText(/Couldn’t sign out/);
    await expect(signOut).toBeEnabled();
    await expect(page).toHaveURL(origin + '/platform/news');
    expect(attempts).toBe(1);
});

test('uses the mobile chat drawer and returns focus through nested chat dialogs', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.setViewportSize({ width: 320, height: 760 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let title = 'Fixture handoff chat';
    let patches = 0;
    const stamp = '2026-10-01T00:00:00Z';
    const thread = () => ({
        id: fixtureItem, title, locale: 'en', last_activity_at: stamp, expires_at: '2099-01-01T00:00:00Z', created_at: stamp,
        activity_state: 'idle', active_investigation_count: 0,
    });
    await page.route('**/api/cms/admin/operator/threads**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === 'PATCH' && path.endsWith(fixtureItem)) {
            patches++;
            title = request.postDataJSON().title;
            return route.fulfill({ json: thread() });
        }
        if (request.method() !== 'GET') return route.fulfill({ status: 409 });
        return route.fulfill({ json: path.endsWith(fixtureItem)
            ? { thread: thread(), messages: [] }
            : { items: [thread()], next_cursor: '' } });
    });
    await page.goto(origin + '/platform/operator');
    const draft = page.locator('#operator-composer-input');
    await draft.fill('Keep my mobile draft');
    const picker = page.getByRole('button', { name: /Open chats/ });
    await picker.click();
    await page.getByRole('menuitem', { name: 'Chat history' }).click();
    const drawer = page.getByRole('dialog', { name: 'Chat and details' });
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(320);
    const rowMenu = drawer.getByRole('button', { name: 'Chat options: Fixture handoff chat' });
    await rowMenu.click();
    await page.getByRole('menuitem', { name: 'Rename chat' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename chat' });
    await rename.getByLabel('Chat name', { exact: true }).fill('Reviewed handoff chat');
    await rename.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(rename).toBeHidden();
    const renamedMenu = drawer.getByRole('button', { name: 'Chat options: Reviewed handoff chat' });
    await expect(renamedMenu).toBeFocused();
    expect(patches).toBe(1);

    await renamedMenu.click();
    await page.getByRole('menuitem', { name: 'Delete conversation' }).click();
    const deletion = page.getByRole('dialog', { name: 'Delete this conversation?' });
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(deletion).toBeHidden();
    await expect(renamedMenu).toBeFocused();
    await drawer.getByRole('button', { name: 'Close sidebar' }).click();
    await expect(drawer).toBeHidden();
    await expect(picker).toBeFocused();
    await expect(draft).toHaveValue('Keep my mobile draft');

    await picker.click();
    await page.getByRole('menuitem', { name: 'العربية', exact: true }).click();
    const arabicPicker = page.getByRole('button', { name: /المحادثات المفتوحة/ });
    await arabicPicker.click();
    await page.getByRole('menuitem', { name: 'سجل المحادثات', exact: true }).click();
    const arabicDrawer = page.getByRole('dialog', { name: 'المحادثة والتفاصيل' });
    await expect(arabicDrawer).toHaveAttribute('dir', 'rtl');
    const arabicBox = await arabicDrawer.boundingBox();
    expect(arabicBox!.x).toBeGreaterThan(0);
    expect(arabicBox!.x + arabicBox!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
    await expect(arabicDrawer).toBeHidden();
    await expect(arabicPicker).toBeFocused();
    await expect(draft).toHaveValue('Keep my mobile draft');
});

test('retains approval errors inside the exact signed plan review', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const planID = '22222222-2222-4222-8222-222222222222';
    const investigation = '33333333-3333-4333-8333-333333333333';
    const approvals: unknown[] = [];
    const finishFirstApproval = Promise.withResolvers<void>();
    const expires = '2099-01-01T00:00:00Z';
    const tool = 'media_sources.pause';
    const signedPlan = () => ({
        id: planID, investigation_id: investigation, state: approvals.length > 1 ? 'queued' : 'awaiting_approval',
        tool_key: tool, risk_tier: 'high_impact', expires_at: expires, digest: 'a'.repeat(64),
        confirmation_phrases: ['REVIEW SOURCE', 'راجع المصدر'],
        localized_action_key: 'operator.action.media_sources_pause', target_type: 'source',
        canonical_plan: {
            schema_version: 'wahb-operator/v1', plan_id: planID, tenant_id: 'fixture-tenant', actor_id: 'fixture-operator',
            tool_key: tool, tool_version: '1', target_ids: ['fixture-source'], normalized_arguments: {},
            evidence_ids: ['fixture-evidence'], evidence_fingerprint: 'fixture-fingerprint', access_version: '1',
            risk_tier: 'high_impact', cancellation: 'before_start_only', rollback: 'media_sources.resume', contingencies: ['Recheck source health'],
        },
    });
    await page.route(`**/api/cms/admin/operator/plans/${planID}**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/approve')) {
            approvals.push(route.request().postDataJSON());
            if (approvals.length === 1) {
                await finishFirstApproval.promise;
                return route.fulfill({ status: 503, json: { message: 'Fixture owner unavailable' } });
            }
        }
        if (path.endsWith('/events')) return route.fulfill({ json: { id: planID, state: signedPlan().state, events: [], next_sequence: 0 } });
        return route.fulfill({ json: signedPlan() });
    });
    await page.goto(origin + `/platform/operator?plan=${planID}&panel=plan`);
    const trigger = page.getByRole('button', { name: 'Approve high-impact plan', exact: true });
    await trigger.click();
    const review = page.getByRole('dialog', { name: 'Approve high-impact plan' });
    const confirm = review.getByRole('button', { name: 'Approve high-impact plan', exact: true });
    await expect(confirm).toBeDisabled();
    await review.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(review).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(approvals).toHaveLength(0);

    await trigger.click();
    await review.getByPlaceholder('REVIEW SOURCE').fill('REVIEW SOURCE');
    try {
        await confirm.click();
        await expect(confirm).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(review).toBeVisible();
        await expect.poll(() => approvals.length).toBe(1);
    } finally {
        finishFirstApproval.resolve();
    }
    await expect(review.getByRole('alert')).toHaveText('Fixture owner unavailable');
    expect(approvals).toEqual([{ confirmation: 'REVIEW SOURCE' }]);
    await confirm.click();
    await expect(review).toBeHidden();
    await expect(trigger).toHaveCount(0);
    expect(approvals).toEqual([{ confirmation: 'REVIEW SOURCE' }, { confirmation: 'REVIEW SOURCE' }]);
});

test('saves a question, displays its cited reply, and preserves the next draft across inspectors', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.setViewportSize({ width: 1280, height: 800 });
    const investigation = '33333333-3333-4333-8333-333333333333';
    const evidence = '44444444-4444-4444-8444-444444444444';
    const question = 'What is blocking the fixture source?';
    const stamp = '2026-10-01T00:00:00Z';
    const expires = '2099-01-01T00:00:00Z';
    const thread = { id: fixtureItem, title: question, locale: 'en', last_activity_at: stamp, created_at: stamp,
        expires_at: expires, activity_state: 'completed', active_investigation_count: 0 };
    const writes: string[] = [];
    let submitted = false;
    let sourceReads = 0;
    await page.route('**/api/cms/admin/operator/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const reply = (json: unknown) => route.fulfill({ json });
        if (path.endsWith('/threads') && request.method() === 'POST') {
            writes.push('thread');
            return reply(thread);
        }
        if (path.endsWith('/investigations') && request.method() === 'POST') {
            writes.push('question');
            expect(request.postDataJSON()).toMatchObject({ message: question, thread_id: fixtureItem, spend_acknowledged: false });
            submitted = true;
            return reply({ investigation_id: investigation, state: 'backgrounded' });
        }
        if (path.endsWith('/read') && request.method() === 'POST') return reply({});
        if (path.endsWith('/briefings') && request.method() === 'POST') return route.fallback();
        if (request.method() !== 'GET') return route.fulfill({ status: 409 });
        if (path.endsWith('/threads')) return reply({ items: submitted ? [thread] : [], next_cursor: '' });
        if (path.endsWith('/threads/' + fixtureItem)) return reply({ thread, messages: submitted ? [{
            id: '55555555-5555-4555-8555-555555555555', actor_type: 'admin', kind: 'question',
            created_at: stamp, investigation_id: investigation, content: { text: question },
        }, {
            id: '66666666-6666-4666-8666-666666666666', actor_type: 'operator', kind: 'response',
            created_at: stamp, investigation_id: investigation,
            content: { blocks: [{ kind: 'fact', text: 'The fixture source is waiting for approval.', evidence_ids: ['source-proof'] }] },
        }] : [] });
        if (path.endsWith('/evidence')) {
            sourceReads++;
            return reply({ items: [{
                id: evidence, evidence_id: 'source-proof', authority: 'CMS', domain: 'sources',
                adapter_key: 'sources', adapter_version: '1', required_permission: 'feed:read', record_refs: [],
                deep_link: '/platform/sources', observed_at: stamp, fetched_at: stamp, expires_at: expires,
                availability: 'available', source_version: '1',
            }] });
        }
        if (path.endsWith('/events')) return reply({ investigation_id: investigation, state: 'completed', events: [], next_sequence: 0 });
        if (path.endsWith('/tasks')) return reply({ items: [], next_cursor: '' });
        if (path.endsWith('/eligible-actions') || path.endsWith('/recommendations')) return reply({ items: [] });
        if (path.endsWith('/controls')) return reply({ operational: true, controls: {
            read_enabled: true, llm_enabled: true, execution_enabled: false, schedules_enabled: false,
        } });
        return route.fallback();
    });
    await page.goto(origin + '/platform/operator');
    const composer = page.locator('#operator-composer-input');
    await composer.fill(question);
    await composer.press('Enter');
    const claim = 'The fixture source is waiting for approval.';
    await expect(page.getByText(claim, { exact: true }).first()).toBeVisible();
    await expect(composer).toHaveValue('');
    expect(writes).toEqual(['thread', 'question']);
    expect(sourceReads).toBe(0);

    await composer.fill('Keep this next draft');
    await page.getByRole('button', { name: /Sources/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open current record' })).toHaveAttribute('href', '/platform/sources');
    expect(sourceReads).toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: 'Close sidebar' }).click();

    const menu = page.getByRole('button', { name: 'Chat options', exact: true });
    await menu.click();
    await page.getByRole('menuitem', { name: 'Activity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close sidebar' }).click();
    await menu.click();
    await page.getByRole('menuitem', { name: 'Operator status', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Operator status', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Economics', exact: true })).toBeVisible();
    await expect(composer).toHaveValue('Keep this next draft');
    expect(writes).toEqual(['thread', 'question']);
});
