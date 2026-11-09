import { expect, test, type Page } from '@playwright/test';
import { fixtureLogin, fixtureOrigin, studioUrl } from './fixtures/qualification';

test.skip(!process.env.CONSOLE_QUALIFICATION_ORIGIN, 'Requires the production fixture runner');
test.setTimeout(20 * 60_000);

type Milestones = {
    destination: number;
    usable: number;
    apiRequests: number;
    documents: number;
    assetBytes: number;
    lastScript: number;
    lastApi: number;
    apiWindow: number;
    frameTail: number;
};

type Journey = {
    name: string;
    from?: string;
    to: string;
    control?: { role: 'link' | 'tab'; name: string };
    heading: string;
    ready: string;
    criticalApi?: string;
};

const journeys: Journey[] = [
    {
        name: 'news-to-media', from: '/platform/news', to: '/platform/media/atomization',
        control: { role: 'link', name: 'Media Studio' }, heading: 'Atomization workflow', ready: 'Fixture Studio episode', criticalApi: '/pipeline',
    },
    {
        name: 'media-to-news', from: '/platform/media/atomization', to: '/platform/news',
        control: { role: 'link', name: 'News' }, heading: 'News', ready: 'Fixture News article',
    },
    {
        name: 'news-stories-tab', from: '/platform/news', to: '/platform/news?view=topics',
        control: { role: 'tab', name: 'Stories' }, heading: 'News', ready: 'No stories here.',
    },
    { name: 'studio-direct', to: studioUrl, heading: 'Media Studio', ready: 'Fixture chapter' },
];

const operatorJourney: Journey = {
    name: 'console-to-operator', from: '/platform/news', to: '/platform/operator',
    control: { role: 'link', name: 'Operator' }, heading: 'Wahb Operator',
    ready: 'Execution is disabled. Read workflows remain available.', criticalApi: '/operator/status',
};

function percentile(values: number[], p: number) {
    const sorted = [...values].sort((a, b) => a - b);
    return Math.round(sorted[Math.ceil(sorted.length * p) - 1] * 10) / 10;
}

type BrowserTiming = { start?: number; destination?: number; usable?: number };
type BenchmarkWindow = Window & { consoleQualificationTiming?: BrowserTiming };

function captureFrames({ journey, onInput }: { journey: Journey; onInput: boolean }) {
    const state: BrowserTiming = {};
    (window as BenchmarkWindow).consoleQualificationTiming = state;
    const visible = (element: Element) =>
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const matches = (selector: string, text: string) =>
        Array.from(document.querySelectorAll(selector)).some((element) =>
            element.textContent?.trim() === text && visible(element));
    const start = (time: number) => {
        state.start = time;
        const frame = () => {
            const now = performance.now() - time;
            if (state.destination === undefined) {
                const shown = journey.control?.role === 'tab'
                    ? matches('main [role="tab"][aria-selected="true"]', journey.control.name)
                    : matches('main h1, main h2, main h3', journey.heading);
                if (shown) state.destination = now;
            }
            if (state.destination !== undefined) {
                const ready = journey.name === 'studio-direct'
                    ? Array.from(document.querySelectorAll<HTMLInputElement>('main input[placeholder="Chapter title"]'))
                        .some((input) => input.value === journey.ready && visible(input))
                    : matches('main a, main button, main span, main p, main h2, main h3, main div', journey.ready);
                if (ready) state.usable = now;
            }
            if (state.usable === undefined) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    };
    if (onInput) {
        document.addEventListener('click', () => start(performance.now()), { once: true, capture: true });
    } else {
        start(0);
    }
}

async function measure(page: Page, origin: string, journey: Journey, warm: boolean): Promise<Milestones> {
    const destinationURL = journey === operatorJourney
        ? (url: URL) => url.origin === origin && url.pathname === journey.to
        : origin + journey.to;
    let documents = 0;
    let apiRequests = 0;
    let counting = false;
    page.on('request', (request) => {
        if (!counting) return;
        if (request.isNavigationRequest() && request.resourceType() === 'document') documents++;
        if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests++;
    });
    if (journey.from && journey.control) {
        await page.goto(origin + journey.from, { waitUntil: 'domcontentloaded' });
        const control = page.getByRole(journey.control.role, { name: journey.control.name, exact: true }).first();
        await expect(control).toBeVisible();
        if (warm) {
            await control.click({ timeout: 5_000 });
            await expect(page).toHaveURL(destinationURL);
            await expect(page.getByText(journey.ready, { exact: true }).first()).toBeVisible();
            if (journey.control.role === 'tab') {
                await page.getByRole('tab', { name: 'Overview' }).click({ timeout: 5_000 });
            } else {
                await page.goBack();
            }
            await expect(page).toHaveURL(origin + journey.from);
            await expect(control).toBeVisible();
        }
        await page.evaluate(() => window.performance.clearResourceTimings());
        await page.evaluate(captureFrames, { journey, onInput: true });
        counting = true;
        await control.click({ timeout: 5_000 });
    } else {
        if (warm) {
            await page.goto(origin + journey.to, { waitUntil: 'domcontentloaded' });
            await expect(page.getByPlaceholder('Chapter title').first()).toHaveValue(journey.ready);
        }
        await page.addInitScript(captureFrames, { journey, onInput: false });
        counting = true;
        if (warm) await page.reload({ waitUntil: 'commit' });
        else await page.goto(origin + journey.to, { waitUntil: 'commit' });
    }
    await expect(page).toHaveURL(destinationURL);
    await page.waitForFunction(() => (window as BenchmarkWindow).consoleQualificationTiming?.usable !== undefined, null, { timeout: 10_000 });
    const { destination, usable, assetBytes, lastScript, lastApi, apiWindow, frameTail } = await page.evaluate((criticalApi) => {
        const marks = (window as BenchmarkWindow).consoleQualificationTiming!;
        const start = marks.start ?? 0;
        const end = start + (marks.usable ?? 0);
        const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
            .filter((entry) => entry.responseEnd >= start && entry.responseEnd <= end);
        const assets = resources.filter((entry) => /\/(assets|_next\/static)\//.test(new URL(entry.name).pathname));
        const scripts = assets.filter((entry) => /\.m?js$/.test(new URL(entry.name).pathname));
        const api = resources.filter((entry) => {
            const path = new URL(entry.name).pathname;
            return path.startsWith('/api/') && (!criticalApi || path.endsWith(criticalApi));
        });
        const lastScript = Math.max(0, ...scripts.map((entry) => entry.responseEnd - start));
        const lastApi = Math.max(0, ...api.map((entry) => entry.responseEnd - start));
        const apiWindow = api.length ? lastApi - Math.min(...api.map((entry) => Math.max(0, entry.startTime - start))) : 0;
        const frameTail = Math.max(0, (marks.usable ?? 0) - Math.max(lastApi, lastScript));
        return { ...marks, lastScript, lastApi, apiWindow, frameTail, assetBytes: assets.reduce((sum, entry) => sum + entry.transferSize, 0) };
    }, journey.criticalApi);
    if (destination === undefined || usable === undefined) throw new Error('Incomplete frame timing');
    return { destination, usable, apiRequests, documents, assetBytes, lastScript, lastApi, apiWindow, frameTail };
}

test('records production fixture navigation milestones', async ({ browser }, testInfo) => {
    const comparing = Boolean(process.env.CONSOLE_BASELINE_ORIGIN);
    const samples = Number(process.env.CONSOLE_BENCH_RUNS ?? (comparing ? 50 : 15));
    if (!Number.isSafeInteger(samples) || samples < 1) throw new Error('Invalid benchmark repetition count');
    const origins = { next: comparing ? fixtureOrigin(process.env.CONSOLE_BASELINE_ORIGIN) : '', start: fixtureOrigin() };
    const variants = comparing ? ['next', 'start'] as const : ['start'] as const;
    const rows = [];
    for (const journey of comparing ? journeys : [journeys[0], operatorJourney]) {
        for (const warm of [false, true]) {
            const results: Record<keyof typeof origins, Milestones[]> = { next: [], start: [] };
            for (let iteration = 0; iteration < samples; iteration++) {
                const order = iteration % 2 ? [...variants].reverse() : variants;
                for (const variant of order) {
                    const origin = origins[variant];
                    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
                    try {
                        await fixtureLogin(context, origin);
                        const page = await context.newPage();
                        results[variant].push(await measure(page, origin, journey, warm));
                    } finally {
                        await context.close();
                    }
                }
            }
            for (const variant of variants) {
                const entries = results[variant];
                rows.push({
                    journey: journey.name, warm, variant, samples,
                    destinationP50: percentile(entries.map((entry) => entry.destination), 0.5),
                    destinationP95: percentile(entries.map((entry) => entry.destination), 0.95),
                    usableP50: percentile(entries.map((entry) => entry.usable), 0.5),
                    usableP95: percentile(entries.map((entry) => entry.usable), 0.95),
                    apiRequestsP50: percentile(entries.map((entry) => entry.apiRequests), 0.5),
                    documentRequestsP95: percentile(entries.map((entry) => entry.documents), 0.95),
                    lastScriptP50: percentile(entries.map((entry) => entry.lastScript), 0.5),
                    lastApiP50: percentile(entries.map((entry) => entry.lastApi), 0.5),
                    apiWindowP50: percentile(entries.map((entry) => entry.apiWindow), 0.5),
                    frameTailP50: percentile(entries.map((entry) => entry.frameTail), 0.5),
                    assetBytesP50: percentile(entries.map((entry) => entry.assetBytes), 0.5),
                });
            }
            console.log(JSON.stringify(rows.slice(-variants.length)));
        }
    }
    await testInfo.attach('console-routing-timings', { body: JSON.stringify(rows), contentType: 'application/json' });
});
