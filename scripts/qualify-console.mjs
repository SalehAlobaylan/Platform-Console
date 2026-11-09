import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

const cleanups = [];
const fixtureItem = '11111111-1111-4111-8111-111111111111';
const episode = {
    id: fixtureItem, title: 'Fixture Studio episode', source_name: 'Fixture source',
    duration_sec: 3000, type: 'PODCAST', status: 'PENDING', lane: 'awaiting_download',
    allowed_actions: ['download'], actions: [{ code: 'download', label: 'Download', enabled: true }],
};
const news = {
    ...episode, id: '22222222-2222-4222-8222-222222222222', title: 'Fixture News article',
    type: 'NEWS', format: 'ARTICLE', status: 'READY',
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};
const fixtureAccounts = [
    { email: 'operator@example.test', id: 'fixture-operator', access: 'fixture-access', refresh: 'fixture-refresh', article: news },
    { email: 'reviewer@example.test', id: 'fixture-reviewer', access: 'fixture-reviewer-access', refresh: 'fixture-reviewer-refresh', article: { ...news, title: 'Reviewer-only fixture article' } },
];
const items = (items = []) => ({ items, total: items.length, page: 1, limit: 20, total_pages: 1 });
const upgradeAttempts = [];
const passkeys = new Map();
const ceremonies = new Map();
const resetTokens = new Set(['fixture-reset']);
let authFixtureOrigin;

async function bind(server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    cleanups.unshift(() => {
        server.closeAllConnections();
        server.close();
    });
    return `http://127.0.0.1:${server.address().port}`;
}

function reply(response, data, status = 200) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(data));
}

const upstream = await bind(createServer(async (incoming, outgoing) => {
    const { pathname, searchParams } = new URL(incoming.url, 'http://fixture.test');
    const method = incoming.method;
    if (process.env.DEBUG_CONSOLE_QUALIFICATION) console.log('Fixture request', method, pathname);
    if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/refresh') {
        if (method !== 'POST') return reply(outgoing, {}, 405);
        let body = '';
        for await (const chunk of incoming) body += chunk;
        const credentials = JSON.parse(body);
        const account = pathname.endsWith('/login')
            ? fixtureAccounts.find(({ email }) => email === credentials.email && credentials.password === 'fixture-only')
            : fixtureAccounts.find(({ refresh }) => refresh === credentials.refresh_token);
        if (!account) return reply(outgoing, { message: 'Invalid credentials' }, 401);
        return reply(outgoing, { access_token: account.access, refresh_token: account.refresh, expires_in: 3600 });
    }
    if (pathname === '/api/v1/auth/console-capabilities') {
        return reply(outgoing, { origin: authFixtureOrigin, recovery: true, passkeys: true });
    }
    if (pathname === '/api/v1/auth/revoke-session') return reply(outgoing, { success: true });
    if (pathname === '/api/v1/auth/forgot-password' || pathname === '/api/v1/auth/reset-password' ||
        pathname.startsWith('/api/v1/auth/passkeys')) {
        let body = '';
        for await (const chunk of incoming) body += chunk;
        const input = body ? JSON.parse(body) : {};
        if (pathname.endsWith('/forgot-password')) return reply(outgoing, { success: input.client === 'console' });
        if (pathname.endsWith('/reset-password')) return reply(outgoing, {}, resetTokens.delete(input.token) ? 200 : 400);

        const registration = pathname.includes('/registration/');
        const authentication = pathname.includes('/authentication/');
        if (!authentication && incoming.headers.authorization !== 'Bearer fixture-access') {
            return reply(outgoing, {}, 401);
        }
        if (pathname.endsWith('/passkeys')) return reply(outgoing, [...passkeys.values()]);
        if (pathname.endsWith('/remove')) {
            if (input.password !== 'fixture-only') return reply(outgoing, {}, 401);
            passkeys.delete(input.id);
            return reply(outgoing, {});
        }
        if (pathname.endsWith('/begin')) {
            if (registration && input.password !== 'fixture-only') return reply(outgoing, {}, 401);
            const binding = randomBytes(32).toString('base64url');
            const challenge = randomBytes(32).toString('base64url');
            ceremonies.set(binding, { registration, challenge });
            return reply(outgoing, { binding, options: { publicKey: registration ? {
                challenge, rp: { id: 'localhost', name: 'Wahb Console' },
                user: { id: Buffer.from('fixture-operator').toString('base64url'), name: 'operator@example.test', displayName: 'Operator' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
            } : { challenge, rpId: 'localhost', userVerification: 'required' } } });
        }
        const ceremony = ceremonies.get(input.binding);
        ceremonies.delete(input.binding);
        const credential = input.credential;
        if (!ceremony || ceremony.registration !== registration || !credential?.response?.clientDataJSON) {
            return reply(outgoing, {}, 400);
        }
        const data = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString());
        if (data.challenge !== ceremony.challenge || data.origin !== authFixtureOrigin ||
            data.type !== (registration ? 'webauthn.create' : 'webauthn.get')) {
            return reply(outgoing, {}, 400);
        }
        if (registration && credential.response.attestationObject) {
            passkeys.set(credential.id, { id: credential.id, created_at: new Date().toISOString() });
            return reply(outgoing, {});
        }
        if (passkeys.has(credential.id) && credential.response.signature) {
            return reply(outgoing, { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600 });
        }
        return reply(outgoing, {}, 401);
    }
    if (pathname === '/api/v1/auth/logout' && method === 'POST') return reply(outgoing, { success: true });
    if (pathname === '/api/v1/roles/me') {
        const account = fixtureAccounts.find(({ access }) => incoming.headers.authorization === `Bearer ${access}`);
        if (!account) return reply(outgoing, {}, 401);
        return reply(outgoing, { user_id: account.id, email: account.email, tenant_id: 'fixture-tenant', role: 'admin', roles: ['admin'], is_admin: true, permissions: ['*:*'] });
    }
    if (pathname === '/admin/qualification/wire') {
        if (method === 'POST') {
            const chunks = [];
            for await (const chunk of incoming) chunks.push(chunk);
            const body = gzipSync(Buffer.concat(chunks));
            outgoing.writeHead(201, {
                'content-type': incoming.headers['content-type'], 'content-encoding': 'gzip', 'content-length': body.length,
                'cache-control': 'public, max-age=3600',
            });
            return outgoing.end(body);
        }
        const status = Number(searchParams.get('status'));
        outgoing.writeHead([204, 205, 304].includes(status) ? status : 204, { 'x-fixture-method': method });
        return outgoing.end();
    }
    if (pathname === '/admin/local-environments/upgrade' && method === 'POST') {
        let body = '';
        for await (const chunk of incoming) body += chunk;
        upgradeAttempts.push({
            body: JSON.parse(body),
            machineAuthorized: incoming.headers.authorization === 'Bearer fixture-machine',
            actorAuthorized: incoming.headers['x-wahb-actor-token'] === 'fixture-access',
            runtime: incoming.headers['x-wahb-runtime-id'],
        });
    }
    if (method !== 'GET' && method !== 'HEAD') return reply(outgoing, { message: 'Qualification fixtures refuse owner effects' }, 409);
    if (pathname === '/admin/qualification/upgrade-attempts') return reply(outgoing, upgradeAttempts);
    if (pathname === '/admin/qualification/echo') {
        return reply(outgoing, { path: incoming.url, authorization: incoming.headers.authorization, cookie: incoming.headers.cookie ?? null });
    }
    if (pathname.endsWith('/health') || pathname.endsWith('/ready')) return reply(outgoing, { status: 'healthy' });
    if (pathname === '/metrics') {
        outgoing.writeHead(200, { 'content-type': 'text/plain' });
        return outgoing.end('# No workload in fixture\n');
    }
    if (pathname === '/admin/sources/news/collection') {
        return reply(outgoing, { readiness: { paused: false, blockers: [] }, enabled: 0 });
    }
    if (pathname === '/admin/sources' || pathname === '/admin/feeds') {
        return reply(outgoing, { ...items(), data: [] });
    }
    if (pathname === '/admin/content/stories') {
        return reply(outgoing, { topics: [], data: [], total: 0, uncategorized: { total: 0 } });
    }
    if (pathname === '/admin/ops/attention') {
        return reply(outgoing, { data: { as_of: news.updated_at, items: [], adapter_errors: [], total: 0, offset: 0, limit: 20, has_more: false } });
    }
    if (pathname === '/admin/experience/runs') return reply(outgoing, { data: [] });
    if (pathname === '/admin/operator/status') {
        return reply(outgoing, { operational: true, controls: { read_enabled: true, llm_enabled: true, execution_enabled: false, schedules_enabled: false } });
    }
    if (pathname === '/admin/content' || pathname === '/admin/content/') {
        await delay(90);
        const account = fixtureAccounts.find(({ access }) => incoming.headers.authorization === `Bearer ${access}`);
        const rows = searchParams.get('status') === 'FAILED' ? [] : [account?.article ?? news];
        return reply(outgoing, { ...items(rows), data: rows });
    }
    if (pathname.endsWith('/pipeline')) {
        await delay(90);
        return reply(outgoing, { data: { ...items([episode]), counts: [{ key: 'download_approval', label: 'Approval needed', count: 1 }], next_cursor: '', columns: [], updated_at: news.updated_at } });
    }
    if (pathname.endsWith('/journey')) return reply(outgoing, { data: {
        parent: episode, item: episode,
        steps: [{ key: 'download', state: 'waiting', required: true, reason_code: 'download_approval' }],
        capacity: { waiting: false }, acquisition_mode: 'manual', auto_stt_enabled: false, caption_outcome: 'not_checked_or_unknown',
    } });
    if (pathname.endsWith('/studio')) return reply(outgoing, { data: {
        content: episode, transcript: { transcript_id: 'fixture-transcript', full_text: 'Fixture transcript', segments: [{ start: 0, end: 3000, text: 'Fixture transcript' }] },
        chapters: [{ title: 'Fixture chapter', start_ms: 0, end_ms: 3000000, source: 'manual' }],
    } });
    if (pathname.endsWith('/context')) return reply(outgoing, { data: { parent: episode, children: [], recent_runs: [] } });
    if (pathname.endsWith('/chapter-plans')) return reply(outgoing, { data: { items: [], input_fingerprint: 'fixture', worker_supported: true } });
    if (pathname.endsWith('/events')) return reply(outgoing, { investigation_id: fixtureItem, state: 'running', events: [], next_sequence: 4 });
    if (pathname.endsWith('/upgrade-job')) return reply(outgoing, { message: 'No fixture job' }, 404);
    return reply(outgoing, { data: { ...items(), columns: [], schema_status: { ready: true } } });
}));

async function availablePort() {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((done) => probe.close(done));
    return port;
}

async function launch(entry, managed = true, runtime = 'fixture-launch') {
    const artifact = resolve(entry);
    if (!existsSync(artifact)) throw new Error(`Build the production artifact first: ${entry}`);
    const port = await availablePort();
    const env = {
        PATH: process.env.PATH,
        NODE_ENV: 'production', HOST: '127.0.0.1', HOSTNAME: '127.0.0.1', PORT: String(port),
        ...(managed && { WAHB_RUNTIME_ID: runtime, WAHB_MANAGED_ENV: '1' }), NEXT_TELEMETRY_DISABLED: '1',
        CMS_BASE_URL: upstream, IAM_BASE_URL: upstream, AGGREGATION_BASE_URL: upstream,
        LOCAL_QUICK_SIGN_IN_EMAIL: 'operator@example.test', LOCAL_QUICK_SIGN_IN_PASSWORD: 'fixture-only',
        ENRICHMENT_BASE_URL: upstream, MEDIA_BASE_URL: upstream, PLATFORM_BASE_URL: upstream,
        MIGRATION_COORDINATOR_URL: upstream, MIGRATION_COORDINATOR_READ_TOKEN: 'fixture-machine',
    };
    const child = spawn(process.execPath, [artifact], { cwd: dirname(artifact), env, stdio: 'inherit' });
    cleanups.unshift(() => child.kill());
    const origin = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error('Console artifact exited before readiness');
        if (await fetch(`${origin}/login`).then((r) => r.ok, () => false)) return origin;
        await delay(100);
    }
    throw new Error('Console artifact never became ready');
}

function forward(incoming, outgoing, target) {
    const headers = { ...incoming.headers, host: new URL(target).host };
    if (headers.origin) headers.origin = target;
    const forwarded = httpRequest(`${target}${incoming.url}`, { method: incoming.method, headers }, (result) => {
        outgoing.writeHead(result.statusCode, result.headers);
        result.pipe(outgoing);
    });
    forwarded.on('error', () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
    });
    incoming.pipe(forwarded);
}

try {
    let origin = await launch('.output/server/index.mjs');
    authFixtureOrigin = origin.replace('127.0.0.1', 'localhost');
    let baseline;
    let contractBaseline;
    let unmanaged;
    let unmanagedBaseline;
    let restartOrigin;
    const benchmark = process.argv[2] === 'benchmark';
    const workflows = process.argv[2] === 'workflows';
    if (benchmark) {
        if (!process.env.CONSOLE_NEXT_ARTIFACT) throw new Error('Set CONSOLE_NEXT_ARTIFACT to the archived Next standalone server.js');
        const next = await launch(process.env.CONSOLE_NEXT_ARTIFACT, false);
        // Hold the API code fixed for both production router builds.
        const start = origin;
        baseline = await bind(createServer((incoming, outgoing) => forward(incoming, outgoing, next)));
        origin = await bind(createServer((incoming, outgoing) => forward(incoming, outgoing, incoming.url.startsWith('/api/') ? next : start)));
    } else if (!workflows) {
        unmanaged = await launch('.output/server/index.mjs', false);
        const restarted = await launch('.output/server/index.mjs', true, 'fixture-restarted');
        let active = origin;
        restartOrigin = await bind(createServer((incoming, outgoing) => {
            if (incoming.method === 'POST' && ['/__fixture/before', '/__fixture/after'].includes(incoming.url)) {
                active = incoming.url.endsWith('/after') ? restarted : origin;
                return reply(outgoing, { switched: true });
            }
            forward(incoming, outgoing, active);
        }));
        if (process.env.CONSOLE_NEXT_ARTIFACT) {
            contractBaseline = await launch(process.env.CONSOLE_NEXT_ARTIFACT);
            unmanagedBaseline = await launch(process.env.CONSOLE_NEXT_ARTIFACT, false);
        }
    }
    const projects = benchmark ? ['chromium'] : process.argv.slice(workflows ? 3 : 2);
    if (!projects.length) projects.push('chromium');
    if (projects.some((project) => !['chromium', 'firefox', 'webkit'].includes(project))) {
        throw new Error('Choose chromium, firefox, or webkit for fixture qualification');
    }
    const specs = benchmark ? ['console-routing-benchmark.spec.ts']
        : workflows ? ['media-journey.spec.ts', 'platform-economics.spec.ts', 'real-experience.spec.ts', 'ai-spend.spec.ts']
        : ['console-route-parity.spec.ts', 'console-api-contract.spec.ts', 'console-operator-parity.spec.ts'];
    const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...projects.map((project) => `--project=${project}`), '--workers=1', '--retries=0', '--reporter=list', '--output', `test-results/qualification-${process.pid}`, ...specs], {
        env: {
            ...process.env,
            PLAYWRIGHT_EXTERNAL_STACK: '1',
            CONSOLE_TEST_ORIGIN: origin,
            CONSOLE_QUALIFICATION_ORIGIN: origin,
            CONSOLE_BASELINE_ORIGIN: baseline ?? '',
            CONSOLE_BASELINE_CONTRACT_ORIGIN: contractBaseline ?? '',
            CONSOLE_UNMANAGED_QUALIFICATION_ORIGIN: unmanaged ?? '',
            CONSOLE_UNMANAGED_BASELINE_ORIGIN: unmanagedBaseline ?? '',
            CONSOLE_RESTART_QUALIFICATION_ORIGIN: restartOrigin ?? '',
        },
        stdio: 'inherit',
    });
    const [code] = await once(runner, 'exit');
    process.exitCode = code ?? 1;
} finally {
    for (const cleanup of cleanups) cleanup();
}
