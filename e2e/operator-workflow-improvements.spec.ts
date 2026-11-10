import { expect, test } from '@playwright/test';
import { fixtureItem, fixtureLogin, fixtureOrigin } from './fixtures/qualification';

test.skip(!process.env.CONSOLE_QUALIFICATION_ORIGIN, 'Requires the fixture-backed production artifact');

const story = 'd0212141-93f2-4488-b125-71c6f27e2e17';
const incident = '4687e3a3-bc46-4b0c-a2a1-65a42ecc6da7';
const nextCase = 'da14cb21-a07c-45e8-8c20-05246d12022a';

test('reopens recent work and persists an exact pinned queue in this browser', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    await page.route('**/api/cms/admin/stories/' + story, route => route.fulfill({ json: { id: story, label: 'Recent fixture story' } }));
    await page.route('**/api/cms/admin/content?*', route => route.fulfill({ json: { data: [], total: 40, total_pages: 2 } }));
    const original = origin + '/platform/news?view=topics&story=' + story;
    await page.goto(original);
    await expect(page.getByRole('heading', { name: 'Recent fixture story' })).toBeVisible();
    const searchRequests: string[] = [];
    page.on('request', request => {
        if (request.url().includes('/sources/lookup')) searchRequests.push(request.url());
    });
    const finder = page.getByRole('button', { name: 'Find & Jump' });
    await finder.click();
    const dialog = page.getByRole('dialog', { name: 'Find & Jump' });
    await expect(dialog.getByRole('link', { name: /Recent fixture story/ })).toBeVisible();
    expect(searchRequests).toHaveLength(0);
    await dialog.getByRole('link', { name: /Failed News/ }).click();
    await expect(page).toHaveURL(origin + '/platform/news?view=library&status=FAILED');
    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    const views = page.getByRole('dialog', { name: 'Saved views' });
    await views.getByRole('textbox', { name: 'View name' }).fill('Failed News triage');
    await views.getByRole('button', { name: 'Save current filters' }).click();
    await expect(views.getByText('View saved.')).toBeVisible();
    await views.getByRole('button', { name: 'Pin', exact: true }).click();
    await expect(views.getByRole('button', { name: 'Unpin' })).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name: 'Go to next page' }).click();
    await expect(page).toHaveURL(origin + '/platform/news?view=library&status=FAILED&news_page=2');
    await finder.click();
    const saved = dialog.getByRole('link', { name: /Failed News triage/ });
    await expect(saved).toHaveAttribute('href', '/platform/news?view=library&status=FAILED');
    await saved.click();
    await expect(page).toHaveURL(origin + '/platform/news?view=library&status=FAILED');
    await finder.click();
    await dialog.getByRole('link', { name: /Recent fixture story/ }).click();
    await expect(page).toHaveURL(original);
    await finder.click();
    const deferred = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/workload/decisions') &&
        new URL(request.url()).searchParams.get('verdict') === 'defer');
    await dialog.getByRole('link', { name: /Deferred work/ }).click();
    await deferred;
    await expect(page).toHaveURL(/tab=activity.*verdict=defer/);
    await finder.click();
    await dialog.getByRole('link', { name: /Chapters awaiting review/ }).click();
    await expect(page).toHaveURL(/tab=review&review=needed/);
});

test('opens a focused trace, reads history on demand, and marks a failed refresh stale', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const title = 'خبر اختباري طويل — fixture delivery item';
    const checkedAt = '2026-11-10T12:00:00Z';
    const row = (status: string) => ({ status, detail: 'CMS fixture evidence.' });
    let failed = false;
    let nextPageFailed = false;
    const details: string[] = [];
    await page.route('**/api/cms/admin/content/' + fixtureItem, route => route.fulfill({ json: {
        id: fixtureItem, type: 'NEWS', title, status: 'FAILED', source_name: 'Fixture source', view_count: 0, like_count: 0, share_count: 0, created_at: checkedAt, updated_at: checkedAt,
    } }));
    await page.route('**/api/cms/admin/content-stages/items/' + fixtureItem + '/trace-summary', route => route.fulfill(failed
        ? { status: 503, json: { message: 'Unavailable' } }
        : { json: { data: {
            version: 'delivery-summary/v1', id: fixtureItem, title, item_type: 'NEWS', as_of: checkedAt, processing_generation: 4,
            source: row('Source recorded'), processing: row('Optional stage needs review'), eligibility: row('Ready for publication check'),
            publication: row('In active News generation'), delivery: row('Evidence unavailable'), observations: [], links: [],
        } } }));
    await page.route('**/api/cms/admin/content-stages/items/' + fixtureItem + '/trace-evidence?*', route => {
        const params = new URL(route.request().url()).searchParams;
        details.push(params.get('section') ?? '');
        if (params.get('before') === '10') {
            return route.fulfill({ status: 403, json: { message: 'Permission denied' } });
        }
        if (params.get('before') === '25') {
            if (!nextPageFailed) {
                nextPageFailed = true;
                return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
            }
            return route.fulfill({ json: { data: { items: [{ id: story, stage: 'story_classification', state: 'verified', owner: 'cms', at: checkedAt, processing_generation: 3 }], next: '10' } } });
        }
        return route.fulfill({ json: { data: { items: [{ id: fixtureItem, stage: 'news_text_embedding', state: 'verified', owner: 'cms', at: checkedAt, processing_generation: 4 }], next: '25' } } });
    });
    await page.goto(origin + '/platform/content/' + fixtureItem);
    await page.getByRole('link', { name: 'View delivery trace' }).click();
    await expect(page).toHaveURL(origin + '/platform/content/' + fixtureItem + '/delivery');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In active News generation · Evidence unavailable' })).toBeVisible();
    expect(details).toEqual([]);
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        await expect(page.getByRole('heading', { name: title })).toBeInViewport();
        expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await page.getByText('Evidence details', { exact: true }).click();
    await expect(page.getByText('news text embedding')).toBeVisible();
    expect(details).toEqual(['attempts']);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('Could not load the next page.')).toBeVisible();
    await expect(page.getByText('news text embedding')).toBeVisible();
    await page.getByRole('button', { name: 'Retry next page' }).click();
    await expect(page.getByText('story classification')).toBeVisible();
    await expect(page.getByText(/Generation 3 · Historical/)).toBeVisible();
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.getByText('Evidence history is unavailable.', { exact: true })).toBeVisible();
    await expect(page.getByText('news text embedding')).toHaveCount(0);
    failed = true;
    await page.getByRole('button', { name: 'Refresh evidence' }).click();
    await expect(page.getByText(/last successful evidence/)).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    failed = false;
    await page.goBack();
    await expect(page).toHaveURL(origin + '/platform/content/' + fixtureItem);
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(origin + '/platform/content/' + fixtureItem + '/delivery');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to item' })).toHaveAttribute('href', '/platform/content/' + fixtureItem);
    expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('opens an exact closed incident directly from Overview', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const url = '/platform/feed-integrity?tab=issues&selected=' + incident;
    await page.route('**/api/cms/admin/ops/attention?*', route => route.fulfill({ json: { data: {
        items: [{ key: incident, severity: 'major', title: 'Fixture incident', href: '/platform/feed-integrity', issue_href: url }],
        total: 1, as_of: new Date().toISOString(), complete: true, adapter_errors: [],
    } } }));
    await page.route('**/api/cms/admin/feed-integrity/status', route => route.fulfill({ json: { data: {
        open_episodes: [], active_suppressions: [], current_observations: [], headline: 'healthy', posture: 'manual_only',
    } } }));
    await page.route('**/api/cms/admin/feed-integrity/episodes/' + incident, route => route.fulfill({ json: { data: {
        id: incident, summary: 'Fixture closed incident', status: 'resolved', severity: 'major', check_key: 'probe_url_dead',
        feed: 'pods', variant: 'default', first_detected_at: '2026-11-09T12:00:00Z',
    } } }));
    await page.goto(origin + '/');
    await page.getByRole('link', { name: 'Fixture incident' }).click();
    await expect(page).toHaveURL(origin + url);
    await expect(page.getByRole('heading', { name: 'Fixture closed incident' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fixture closed incident' })).toBeVisible();
});

test('advances by the owner’s next case, including from a resolved anchor', async ({ context, page }) => {
    const origin = fixtureOrigin();
    await fixtureLogin(context, origin);
    const caseUrl = '/platform/moderation?status=open&page=2&case=';
    await page.route('**/api/cms/admin/moderation/reports?*', route => route.fulfill({ json: { data: [], total: 0, total_pages: 2 } }));
    await page.route('**/api/cms/admin/moderation/comments/review', route => route.fulfill({ json: { data: [], total: 0 } }));
    const caseData = (id: string, status: string) => ({ report: { id, status, target_id: fixtureItem, target_type: 'content', reason: 'test_reason' }, target_available: false });
    await page.route('**/api/cms/admin/moderation/reports/' + fixtureItem, route => route.fulfill({ json: { data: caseData(fixtureItem, 'resolved') } }));
    await page.route('**/api/cms/admin/moderation/reports/' + nextCase, route => route.fulfill({ json: { data: caseData(nextCase, 'open') } }));
    await page.route('**/api/cms/admin/moderation/reports/' + fixtureItem + '/next', route => route.fulfill({ json: { data: { id: nextCase } } }));
    await page.route('**/api/cms/admin/moderation/reports/' + nextCase + '/next', route => route.fulfill({ json: { data: { id: null } } }));
    await page.goto(origin + caseUrl + fixtureItem);
    await expect(page.getByText('Report status: resolved')).toBeVisible();
    await page.getByRole('button', { name: 'Next case', exact: true }).click();
    await expect(page).toHaveURL(origin + caseUrl + nextCase);
    await expect(page.getByText('Report status: open')).toBeVisible();
    await page.getByRole('button', { name: 'Next case', exact: true }).click();
    await expect(page.getByText('End of this queue.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Open reports' })).toBeVisible();
});
