import { dependencyStatus } from '@/lib/system-health';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type {
    DependencyHealth,
    EnvAuditEntry,
    ModelLoad,
    QueueDepth,
    ServiceHealth,
    ServiceName,
    ServiceStatus,
    SystemHealthSnapshot,
    SystemIssue,
    WorkerHealth,
} from '@/types/platform/system-health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACCESS_COOKIE = 'console_access_token';
const PROBE_TIMEOUT_MS = 3000;
const QUEUE_WAITING_WARN = 100;

const ENV_KEYS = [
    'CMS_BASE_URL',
    'IAM_BASE_URL',
    'AGGREGATION_BASE_URL',
    'ENRICHMENT_BASE_URL',
    'MEDIA_BASE_URL',
    'PLATFORM_BASE_URL',
] as const;

interface ProbeResult {
    ok: boolean;
    httpStatus: number | null;
    latencyMs: number | null;
    body: unknown;
    error?: string;
}

async function probe(
    url: string,
    init?: { authorize?: boolean; expectJson?: boolean }
): Promise<ProbeResult> {
    const headers = new Headers();
    if (init?.authorize) {
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get(ACCESS_COOKIE)?.value;
            if (token) headers.set('Authorization', `Bearer ${token}`);
        } catch {
            // ignore — cookie access is best-effort
        }
    }

    const start = performance.now();
    try {
        const resp = await fetch(url, {
            method: 'GET',
            headers,
            cache: 'no-store',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        const latencyMs = Math.round(performance.now() - start);
        let body: unknown = null;
        if (init?.expectJson !== false) {
            const text = await resp.text();
            try {
                body = text ? JSON.parse(text) : null;
            } catch {
                body = text;
            }
        }
        return {
            ok: resp.ok,
            httpStatus: resp.status,
            latencyMs,
            body,
        };
    } catch (err) {
        return {
            ok: false,
            httpStatus: null,
            latencyMs: Math.round(performance.now() - start),
            body: null,
            error: err instanceof Error ? err.message : 'probe failed',
        };
    }
}

function joinUrl(base: string, path: string): string {
    return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function statusFromBool(b: boolean): ServiceStatus {
    return b ? 'healthy' : 'unhealthy';
}

// Build the model-load list from a /ready body. Prefers the richer
// `models_detail` (role in `type`, model id in `name`, optional `dimensions`)
// so the dashboard can show "BAAI/bge-m3 · 1024d" instead of a bare boolean;
// falls back to the legacy `models` bool map for older service builds.
function mapModels(readyBody: Record<string, unknown> | null): ModelLoad[] {
    if (!readyBody) return [];

    const detail = Array.isArray(readyBody.models_detail)
        ? (readyBody.models_detail as unknown[])
        : null;
    if (detail && detail.length > 0) {
        return detail
            .map((d) => asRecord(d))
            .filter((d): d is Record<string, unknown> => d !== null)
            .map((d) => {
                const role =
                    typeof d.type === 'string' && d.type ? d.type : String(d.name ?? 'model');
                const name = typeof d.name === 'string' ? d.name : '';
                const dims = typeof d.dimensions === 'number' ? d.dimensions : null;
                const detailStr = name ? `${name}${dims ? ` · ${dims}d` : ''}` : undefined;
                return { name: role, loaded: d.loaded === true, detail: detailStr };
            });
    }

    const modelsObj = asRecord(readyBody.models);
    const models: ModelLoad[] = [];
    if (modelsObj) {
        for (const [name, value] of Object.entries(modelsObj)) {
            const loaded =
                value === true ||
                (typeof value === 'object' &&
                    value !== null &&
                    (value as Record<string, unknown>).loaded === true);
            models.push({ name, loaded });
        }
    }
    return models;
}

async function checkCms(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'cms' as ServiceName, displayName: 'CMS' };
    if (!baseUrl) return missing(display, 'CMS_BASE_URL');
    const url = joinUrl(baseUrl, '/health');
    const r = await probe(url);
    const body = asRecord(r.body);
    const reported = body && typeof body.status === 'string' ? (body.status as string) : null;
    const healthy = r.ok && (reported === 'ok' || reported === 'healthy');
    return {
        ...display,
        endpointUrl: url,
        status: healthy ? 'healthy' : 'unhealthy',
        latencyMs: r.latencyMs,
        httpStatus: r.httpStatus,
        // Postgres reachability is implicit — CMS won't return 200 if DB is down at boot.
        deps: [{ name: 'postgres', status: healthy ? 'healthy' : 'unknown' }],
        rawError: r.error,
        raw: r.body,
    };
}

async function checkIam(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'iam' as ServiceName, displayName: 'IAM' };
    if (!baseUrl) return missing(display, 'IAM_BASE_URL');
    const url = joinUrl(baseUrl, '/health');
    const r = await probe(url);
    const body = asRecord(r.body);
    const reportedStatus = body && typeof body.status === 'string' ? (body.status as string) : null;
    const version = body && typeof body.version === 'string' ? (body.version as string) : undefined;
    const healthy = r.ok && reportedStatus === 'healthy';
    return {
        ...display,
        endpointUrl: url,
        status: healthy ? 'healthy' : r.ok ? 'degraded' : 'unhealthy',
        latencyMs: r.latencyMs,
        httpStatus: r.httpStatus,
        version,
        // IAM /health does a DB ping; an unhealthy response implies DB trouble.
        deps: [{ name: 'postgres', status: healthy ? 'healthy' : 'unhealthy' }],
        rawError: r.error,
        raw: r.body,
    };
}

async function checkAggregation(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'aggregation' as ServiceName, displayName: 'Aggregation' };
    if (!baseUrl) return missing(display, 'AGGREGATION_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const queuesUrl = joinUrl(baseUrl, '/admin/queues');
    const [health, ready, queues] = await Promise.all([
        probe(healthUrl),
        probe(readyUrl),
        probe(queuesUrl, { authorize: true }),
    ]);

    const readyBody = asRecord(ready.body);
    const depsObj = readyBody ? asRecord(readyBody.dependencies) : null;
    const deps: DependencyHealth[] = [];
    if (depsObj) {
        for (const [name, value] of Object.entries(depsObj)) {
            const v = typeof value === 'string' ? value : String(value);
            deps.push({ name, status: dependencyStatus(value), detail: v });
        }
    }

    const queueList = Array.isArray(queues.body)
        ? (queues.body as unknown[]).filter((q): q is QueueDepth => {
              const r = asRecord(q);
              return !!r && typeof r.queue === 'string';
          })
        : undefined;

    const reachable = health.ok || ready.ok;
    let status: ServiceStatus;
    if (!reachable) status = 'unhealthy';
    else if (!ready.ok || deps.some((d) => d.status !== 'healthy')) status = 'degraded';
    else if (queueList && queueList.some((q) => q.waiting > QUEUE_WAITING_WARN || q.failed > 0))
        status = 'degraded';
    else status = 'healthy';

    return {
        ...display,
        endpointUrl: baseUrl,
        status,
        latencyMs: health.latencyMs ?? ready.latencyMs,
        httpStatus: health.httpStatus ?? ready.httpStatus,
        deps,
        queues: queueList,
        rawError: health.error || ready.error,
        raw: { health: health.body, ready: ready.body, queues: queues.body },
    };
}

async function checkEnrichment(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'enrichment' as ServiceName, displayName: 'Enrichment' };
    if (!baseUrl) return missing(display, 'ENRICHMENT_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const [health, ready] = await Promise.all([probe(healthUrl), probe(readyUrl)]);

    const healthBody = asRecord(health.body);
    const version =
        healthBody && typeof healthBody.version === 'string'
            ? (healthBody.version as string)
            : undefined;

    const readyBody = asRecord(ready.body);
    const models = mapModels(readyBody);

    const depsObj = readyBody ? asRecord(readyBody.dependencies) : null;
    const deps: DependencyHealth[] = [];
    if (depsObj) {
        for (const [name, value] of Object.entries(depsObj)) {
            const ok = value === true || value === 'ok' || value === 'reachable';
            deps.push({
                name,
                status: statusFromBool(ok),
                detail: typeof value === 'string' ? value : undefined,
            });
        }
    }

    const reachable = health.ok || ready.ok;
    let status: ServiceStatus;
    if (!reachable) status = 'unhealthy';
    else if (models.some((m) => !m.loaded) || deps.some((d) => d.status === 'unhealthy'))
        status = 'degraded';
    else status = 'healthy';

    return {
        ...display,
        endpointUrl: baseUrl,
        status,
        latencyMs: health.latencyMs ?? ready.latencyMs,
        httpStatus: health.httpStatus ?? ready.httpStatus,
        version,
        deps,
        models,
        rawError: health.error || ready.error,
        raw: { health: health.body, ready: ready.body },
    };
}

async function checkMedia(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'media' as ServiceName, displayName: 'Media' };
    if (!baseUrl) return missing(display, 'MEDIA_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const queueUrl = joinUrl(baseUrl, '/health/queue');
    const [health, ready, queue] = await Promise.all([
        probe(healthUrl),
        probe(readyUrl),
        probe(queueUrl),
    ]);

    const healthBody = asRecord(health.body);
    const version =
        healthBody && typeof healthBody.version === 'string'
            ? (healthBody.version as string)
            : undefined;

    const readyBody = asRecord(ready.body);
    const models = mapModels(readyBody);

    const deps: DependencyHealth[] = [];
    const depsObj = readyBody ? asRecord(readyBody.dependencies) : null;
    if (depsObj) {
        for (const [name, value] of Object.entries(depsObj)) {
            const ok = value === true || value === 'ok' || value === 'reachable';
            deps.push({
                name,
                status: statusFromBool(ok),
                detail: typeof value === 'string' ? value : undefined,
            });
        }
    }

    // arq async-transcription worker — a separate deploy with no HTTP port. The
    // Media API observes it through the shared Redis queue (db=2) and reports
    // worker-alive + queue depth + throughput via /health/queue.
    const queueBody = asRecord(queue.body);
    let worker: WorkerHealth | undefined;
    if (queueBody && 'configured' in queueBody) {
        const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
        const configured = queueBody.configured === true;
        const alive = queueBody.worker_alive === true;
        const queued = num(queueBody.queued);
        worker = {
            configured,
            alive,
            queued,
            ongoing: num(queueBody.jobs_ongoing),
            complete: num(queueBody.jobs_complete),
            failed: num(queueBody.jobs_failed),
            retried: num(queueBody.jobs_retried),
        };
        // Idle with no worker (e.g. API-only deploy) is informational, not a
        // failure — only flag unhealthy when jobs are waiting but no worker is
        // consuming them.
        const workerStatus: ServiceStatus = !configured
            ? 'unknown'
            : alive
              ? 'healthy'
              : queued > 0
                ? 'unhealthy'
                : 'unknown';
        deps.push({
            name: 'arq-worker',
            status: workerStatus,
            detail: configured
                ? `${alive ? 'alive' : 'down'} · ${queued} queued`
                : 'not configured',
        });
    }

    const reachable = health.ok || ready.ok;
    let status: ServiceStatus;
    if (!reachable) status = 'unhealthy';
    else if (models.some((m) => !m.loaded) || deps.some((d) => d.status === 'unhealthy'))
        status = 'degraded';
    else status = 'healthy';

    return {
        ...display,
        endpointUrl: baseUrl,
        status,
        latencyMs: health.latencyMs ?? ready.latencyMs,
        httpStatus: health.httpStatus ?? ready.httpStatus,
        version,
        deps,
        models,
        worker,
        rawError: health.error || ready.error,
        raw: { health: health.body, ready: ready.body, queue: queue.body },
    };
}

async function checkPlatform(baseUrl: string | undefined): Promise<ServiceHealth> {
    const display = { name: 'platform' as ServiceName, displayName: 'Wahb-Platform' };
    if (!baseUrl) return missing(display, 'PLATFORM_BASE_URL');
    const r = await probe(baseUrl, { expectJson: false });
    return {
        ...display,
        endpointUrl: baseUrl,
        status: r.ok ? 'healthy' : 'unhealthy',
        latencyMs: r.latencyMs,
        httpStatus: r.httpStatus,
        deps: [],
        rawError: r.error,
    };
}

function missing(
    display: { name: ServiceName; displayName: string },
    envKey: string
): ServiceHealth {
    return {
        ...display,
        endpointUrl: '',
        status: 'unknown',
        latencyMs: null,
        httpStatus: null,
        deps: [],
        rawError: `${envKey} not configured`,
    };
}

function computeOverall(services: ServiceHealth[]): ServiceStatus {
    if (services.some((s) => s.status === 'unhealthy')) return 'unhealthy';
    if (services.some((s) => s.status === 'degraded' || s.status === 'unknown')) return 'degraded';
    return 'healthy';
}

function collectIssues(
    services: ServiceHealth[],
    envAudit: EnvAuditEntry[]
): SystemIssue[] {
    const issues: SystemIssue[] = [];

    for (const env of envAudit) {
        if (!env.present) {
            issues.push({ severity: 'critical', message: `Missing env var: ${env.key}` });
        }
    }

    for (const svc of services) {
        if (svc.status === 'unhealthy') {
            issues.push({
                severity: 'critical',
                service: svc.name,
                message: svc.rawError
                    ? `${svc.displayName} unreachable: ${svc.rawError}`
                    : `${svc.displayName} unhealthy (HTTP ${svc.httpStatus ?? 'n/a'})`,
            });
        }
        for (const dep of svc.deps) {
            if (dep.status === 'unhealthy') {
                issues.push({
                    severity: 'critical',
                    service: svc.name,
                    message: `${svc.displayName} dependency "${dep.name}" is unhealthy${dep.detail ? ` (${dep.detail})` : ''}`,
                });
            }
        }
        for (const q of svc.queues ?? []) {
            if (q.failed > 0) {
                issues.push({
                    severity: 'warning',
                    service: svc.name,
                    message: `Queue "${q.queue}" has ${q.failed} failed job(s)`,
                });
            }
            if (q.waiting > QUEUE_WAITING_WARN) {
                issues.push({
                    severity: 'warning',
                    service: svc.name,
                    message: `Queue "${q.queue}" is backed up (${q.waiting} waiting)`,
                });
            }
        }
        for (const m of svc.models ?? []) {
            if (!m.loaded) {
                issues.push({
                    severity: 'warning',
                    service: svc.name,
                    message: `Model "${m.name}" is not loaded`,
                });
            }
        }
        if (svc.worker) {
            if (svc.worker.configured && !svc.worker.alive && svc.worker.queued > 0) {
                issues.push({
                    severity: 'critical',
                    service: svc.name,
                    message: `Async worker is down with ${svc.worker.queued} job(s) queued`,
                });
            }
            if (svc.worker.failed > 0) {
                issues.push({
                    severity: 'warning',
                    service: svc.name,
                    message: `Async worker has ${svc.worker.failed} failed job(s)`,
                });
            }
        }
    }

    const versions = services
        .filter((s) => s.version)
        .map((s) => ({ name: s.displayName, version: s.version! }));
    const distinct = new Set(versions.map((v) => v.version));
    if (versions.length > 1 && distinct.size > 1) {
        issues.push({
            severity: 'warning',
            message: `Version drift across services: ${versions.map((v) => `${v.name}=${v.version}`).join(', ')}`,
        });
    }

    return issues;
}

export async function GET(): Promise<NextResponse<SystemHealthSnapshot | { message: string }>> {
    // Require an authenticated console session. This snapshot exposes internal
    // service URLs, versions, model inventory and env-var presence — admin-only
    // recon data — so anonymous callers are rejected, matching the sibling
    // restart/migrations routes.
    const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (!accessToken) {
        return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const env: Record<(typeof ENV_KEYS)[number], string | undefined> = {
        // Trim — a stray trailing space in a *_BASE_URL env (easy to leave in a
        // hand-edited .env) otherwise yields URLs like "http://host:5050 /health"
        // that fetch() can't parse.
        CMS_BASE_URL: process.env.CMS_BASE_URL?.trim(),
        IAM_BASE_URL: process.env.IAM_BASE_URL?.trim(),
        AGGREGATION_BASE_URL: process.env.AGGREGATION_BASE_URL?.trim(),
        ENRICHMENT_BASE_URL: process.env.ENRICHMENT_BASE_URL?.trim(),
        MEDIA_BASE_URL: process.env.MEDIA_BASE_URL?.trim(),
        PLATFORM_BASE_URL: process.env.PLATFORM_BASE_URL?.trim(),
    };

    const settled = await Promise.allSettled([
        checkCms(env.CMS_BASE_URL),
        checkIam(env.IAM_BASE_URL),
        checkAggregation(env.AGGREGATION_BASE_URL),
        checkEnrichment(env.ENRICHMENT_BASE_URL),
        checkMedia(env.MEDIA_BASE_URL),
        checkPlatform(env.PLATFORM_BASE_URL),
    ]);

    const services: ServiceHealth[] = settled.map((s, i) => {
        if (s.status === 'fulfilled') return s.value;
        const fallbackName: ServiceName = (
            ['cms', 'iam', 'aggregation', 'enrichment', 'media', 'platform'] as ServiceName[]
        )[i];
        return {
            name: fallbackName,
            displayName: fallbackName,
            endpointUrl: '',
            status: 'unhealthy',
            latencyMs: null,
            httpStatus: null,
            deps: [],
            rawError: s.reason instanceof Error ? s.reason.message : 'probe failed',
        };
    });

    const envAudit: EnvAuditEntry[] = ENV_KEYS.map((key) => ({
        key,
        present: Boolean(env[key]),
    }));

    const snapshot: SystemHealthSnapshot = {
        timestamp: new Date().toISOString(),
        overall: computeOverall(services),
        services,
        envAudit,
        issues: collectIssues(services, envAudit),
    };

    return NextResponse.json(snapshot);
}
