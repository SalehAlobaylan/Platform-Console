import { test, expect } from '@playwright/test';

// Browser-only fixtures: every API call is intercepted; never enqueue real work.
test.describe('Media episode journey', () => {
    const episode = '11111111-1111-4111-8111-111111111111';
    const draftID = '22222222-2222-4222-8222-222222222222';
    test.beforeEach(async ({ context, page, baseURL }) => {
        await context.addCookies([{ name: 'console_access_token', value: 'browser-fixture-only', url: baseURL ?? 'http://localhost:3000' }]);
        await page.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname;
            if (path === '/api/auth/me') return route.fulfill({ json: { user_id: 'operator', email: 'fixture@example.test', roles: ['admin'], role: 'admin', is_admin: true, permissions: ['*:*'] } });
            if (route.request().method() !== 'GET') return route.fulfill({ status: 409, json: { message: 'Fixture forbids unregistered effects' } });
            const item = { id: episode, title: 'حلقة الاختبار', source_name: 'Fixture source', duration_sec: 3000, status: 'PENDING', lane: 'awaiting_download', allowed_actions: ['download'], actions: [{ code: 'download', step: 'download', enabled: true }], updated_at: '2026-09-13T12:00:00Z' };
            if (path.endsWith('/pipeline')) return route.fulfill({ json: { data: { items: [item], total: 1, counts: [{ key: 'awaiting_download', label: 'Awaiting download', count: 1 }], next_cursor: '', updated_at: item.updated_at } } });
            if (path.endsWith('/journey')) return route.fulfill({ json: { data: { parent: item, item, steps: [{ key: 'download', state: 'waiting', required: true, reason_code: 'download_approval' }, { key: 'transcript', state: 'waiting', required: true, reason_code: 'predecessor_required' }], capacity: { waiting: false }, acquisition_mode: 'manual', auto_stt_enabled: false, caption_outcome: 'not_checked_or_unknown', updated_at: item.updated_at } } });
            if (path.endsWith('/studio')) return route.fulfill({ json: { data: { content: { ...item, type: 'PODCAST' }, transcript: { transcript_id: 'transcript', full_text: 'Fixture transcript', segments: [{ start: 0, end: 3000, text: 'Fixture transcript' }] }, chapters: [{ title: 'First', start_ms: 0, end_ms: 1500000, source: 'manual' }, { title: 'Second', start_ms: 1500000, end_ms: 3000000, source: 'manual' }] } } });
            if (path.endsWith('/chapter-plans')) return route.fulfill({ json: { data: { items: [], input_fingerprint: 'fixture-input', worker_supported: true } } });
            if (path.endsWith('/context')) return route.fulfill({ json: { data: { parent: item, children: [], recent_runs: [] } } });
            return route.fulfill({ json: { data: { items: [], columns: [], schema_status: { ready: true } } } });
        });
    });

    test('explains approval versus predecessor waits and opens contextual guide', async ({ page }) => {
        await page.goto('/platform/media/atomization');
        await page.getByRole('button', { name: /حلقة الاختبار/ }).click();
        await expect(page.getByText('Waiting for the preceding requirement, not an approval.')).toBeVisible();
        await expect(page.getByText('Download permission is required.')).toBeVisible();
        await page.getByRole('button', { name: 'How the media journey works' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'What happens', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL(new RegExp(`item=${episode}`));
    });

    test('saving a draft does not apply or process it', async ({ page }) => {
        const writes: string[] = [];
        await page.route('**/chapter-plans', async route => {
            if (route.request().method() === 'GET') return route.fallback();
            writes.push(route.request().url());
            expect(route.request().postDataJSON().expected_revision).toBe(0);
            await route.fulfill({ status: 201, json: { data: { id: 'draft', revision: 1 }, message: 'Draft saved' } });
        });
        await page.goto(`/platform/media/atomization?tab=studio&item=${episode}`);
        await page.getByPlaceholder('Chapter title').first().fill('Meaningful chapter title');
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await expect(page.getByText('Draft saved. Running and published media are unchanged.')).toBeVisible();
        expect(writes).toHaveLength(1);
        expect(writes[0]).not.toContain('/apply');
    });

    test('application confirms the exact draft and reports queued rather than started', async ({ page }) => {
        const plan = [{ title: 'First', start_ms: 0, end_ms: 1500000, source: 'manual' }, { title: 'Second', start_ms: 1500000, end_ms: 3000000, source: 'manual' }];
        await page.route('**/chapter-plans', route => route.fulfill({ json: { data: { items: [{ id: draftID, revision: 2, input_fingerprint: 'fixture-input', plan, validation: [], provenance: 'manual' }], input_fingerprint: 'fixture-input', worker_supported: true, apply_action: { code: 'apply_chapter_plan', step: 'planning', enabled: true } } } }));
        let submitted = false;
        await page.route(`**/chapter-plans/${draftID}/apply`, async route => {
            const body = route.request().postDataJSON();
            expect(body.revision).toBe(2);
            expect(body.input_fingerprint).toBe('fixture-input');
            expect(body.idempotency_key).toBe(draftID);
            submitted = true;
            await route.fulfill({ status: 202, json: { data: { request_id: 'request', state: 'queued' } } });
        });
        await page.goto(`/platform/media/atomization?tab=studio&item=${episode}`);
        await page.getByRole('button', { name: 'Apply plan and process' }).click();
        await expect(page.getByText(/Cost and storage size are unknown/)).toBeVisible();
        expect(submitted).toBe(false);
        await page.getByRole('button', { name: 'Confirm and submit request' }).click();
        await expect(page.getByText(/Request state: queued/)).toBeVisible();
        expect(submitted).toBe(true);
    });
});
