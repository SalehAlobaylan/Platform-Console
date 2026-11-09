import { readCookie } from '@/lib/server/session-cookies';
import {
    aggregationDependencies,
    parseQueueStats,
    queueWarnings,
} from '@/lib/system-health/aggregation';
import type {
    DependencyHealth,
    EnvAuditEntry,
    ModelLoad,
    ServiceHealth,
    ServiceName,
    ServiceProbe,
    ServiceStatus,
    SystemHealthSnapshot,
    SystemIssue,
    WorkerHealth,
} from '@/types/platform/system-health';

const ACCESS_COOKIE = 'console_access_token';
const PROBE_TIMEOUT_MS = 3000;

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
    init?: { accessToken?: string; expectJson?: boolean; signal?: AbortSignal }
): Promise<ProbeResult> {
    const headers = new Headers();
    if (init?.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`);

    const start = performance.now();
    try {
        const resp = await fetch(url, {
            method: 'GET',
            headers,
            cache: 'no-store',
            signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(PROBE_TIMEOUT_MS)])
                : AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        let body: unknown = null;
        if (init?.expectJson !== false) {
            const text = await resp.text();
            try {
                body = text ? JSON.parse(text) : null;
            } catch {
                body = text;
            }
        } else {
            // Consume the page response so timing includes its body and the
            // connection can be reused by later checks.
            await resp.arrayBuffer();
        }
        return {
            ok: resp.ok,
            httpStatus: resp.status,
            latencyMs: Math.round(performance.now() - start),
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

function probeTiming(label: string, endpointUrl: string, result: ProbeResult): ServiceProbe {
    return {
        label,
        endpointUrl,
        latencyMs: result.latencyMs,
        httpStatus: result.httpStatus,
        error: result.error,
    };
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

async function checkCms(baseUrl: string | undefined, signal?: AbortSignal): Promise<ServiceHealth> {
    const display = { name: 'cms' as ServiceName, displayName: 'CMS' };
    if (!baseUrl) return missing(display, 'CMS_BASE_URL');
    const url = joinUrl(baseUrl, '/health');
    const r = await probe(url, { signal });
    const body = asRecord(r.body);
    const reported = body && typeof body.status === 'string' ? (body.status as string) : null;
    const healthy = r.ok && (reported === 'ok' || reported === 'healthy');
    return {
        ...display,
        endpointUrl: url,
        status: healthy ? 'healthy' : 'unhealthy',
        latencyMs: r.latencyMs,
        httpStatus: r.httpStatus,
        probes: [probeTiming('Health', url, r)],
        // Postgres reachability is implicit — CMS won't return 200 if DB is down at boot.
        deps: [{ name: 'postgres', status: healthy ? 'healthy' : 'unknown' }],
        rawError: r.error,
        raw: r.body,
    };
}

async function checkIam(baseUrl: string | undefined, signal?: AbortSignal): Promise<ServiceHealth> {
    const display = { name: 'iam' as ServiceName, displayName: 'IAM' };
    if (!baseUrl) return missing(display, 'IAM_BASE_URL');
    const url = joinUrl(baseUrl, '/health');
    const r = await probe(url, { signal });
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
        probes: [probeTiming('Health', url, r)],
        version,
        // IAM /health does a DB ping; an unhealthy response implies DB trouble.
        deps: [{ name: 'postgres', status: healthy ? 'healthy' : 'unhealthy' }],
        rawError: r.error,
        raw: r.body,
    };
}

async function checkAggregation(
    baseUrl: string | undefined,
    cmsCheck: Promise<ServiceHealth>,
    signal?: AbortSignal,
    accessToken?: string,
): Promise<ServiceHealth> {
    const display = { name: 'aggregation' as ServiceName, displayName: 'Aggregation' };
    if (!baseUrl) return missing(display, 'AGGREGATION_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const queuesUrl = joinUrl(baseUrl, '/admin/queues');
    const [health, ready, queues, cms] = await Promise.all([
        probe(healthUrl, { signal }),
        probe(readyUrl, { signal }),
        probe(queuesUrl, { accessToken, signal }),
        cmsCheck.catch(() => null),
    ]);

    const topology = asRecord(asRecord(cms?.raw)?.supply_owner_readiness)?.aggregation;
    const deps = aggregationDependencies(ready, topology, Date.now());
    const queueList = queues.ok ? parseQueueStats(queues.body) : undefined;
    const queueStatsError = queueList === undefined
        ? queues.error || (queues.ok
            ? 'Invalid queue statistics response'
            : `HTTP ${queues.httpStatus ?? 'unavailable'}`)
        : undefined;

    const reachable = health.ok || ready.ok;
    let status: ServiceStatus;
    if (!reachable) status = 'unhealthy';
    else if (deps.some((d) => d.status === 'unhealthy' || d.status === 'degraded'))
        status = 'degraded';
    else if (!ready.ok || deps.some((d) => d.status === 'unknown')) status = 'unknown';
    else status = 'healthy';

    return {
        ...display,
        endpointUrl: baseUrl,
        status,
        latencyMs: health.latencyMs ?? ready.latencyMs,
        httpStatus: health.httpStatus ?? ready.httpStatus,
        probes: [
            probeTiming('Health', healthUrl, health),
            probeTiming('Readiness', readyUrl, ready),
            probeTiming('Queue statistics', queuesUrl, queues),
        ],
        deps,
        queues: queueList,
        queueStatsError,
        rawError: health.error || ready.error,
        raw: {
            health: health.body,
            ready: ready.body,
            topology: topology ?? null,
            queues: queues.body,
            queuesHttpStatus: queues.httpStatus,
            queueStatsError,
        },
    };
}

async function checkEnrichment(baseUrl: string | undefined, signal?: AbortSignal): Promise<ServiceHealth> {
    const display = { name: 'enrichment' as ServiceName, displayName: 'Enrichment' };
    if (!baseUrl) return missing(display, 'ENRICHMENT_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const [health, ready] = await Promise.all([
        probe(healthUrl, { signal }),
        probe(readyUrl, { signal }),
    ]);

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
        probes: [
            probeTiming('Health', healthUrl, health),
            probeTiming('Readiness', readyUrl, ready),
        ],
        version,
        deps,
        models,
        rawError: health.error || ready.error,
        raw: { health: health.body, ready: ready.body },
    };
}

async function checkMedia(baseUrl: string | undefined, signal?: AbortSignal): Promise<ServiceHealth> {
    const display = { name: 'media' as ServiceName, displayName: 'Media' };
    if (!baseUrl) return missing(display, 'MEDIA_BASE_URL');
    const healthUrl = joinUrl(baseUrl, '/health');
    const readyUrl = joinUrl(baseUrl, '/ready');
    const queueUrl = joinUrl(baseUrl, '/health/queue');
    const [health, ready, queue] = await Promise.all([
        probe(healthUrl, { signal }),
        probe(readyUrl, { signal }),
        probe(queueUrl, { signal }),
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
        probes: [
            probeTiming('Health', healthUrl, health),
            probeTiming('Readiness', readyUrl, ready),
            probeTiming('Async worker', queueUrl, queue),
        ],
        version,
        deps,
        models,
        worker,
        rawError: health.error || ready.error,
        raw: { health: health.body, ready: ready.body, queue: queue.body },
    };
}

async function checkPlatform(baseUrl: string | undefined, signal?: AbortSignal): Promise<ServiceHealth> {
    const display = { name: 'platform' as ServiceName, displayName: 'Wahb-Platform' };
    if (!baseUrl) return missing(display, 'PLATFORM_BASE_URL');
    const r = await probe(baseUrl, { expectJson: false, signal });
    return {
        ...display,
        endpointUrl: baseUrl,
        status: r.ok ? 'healthy' : 'unhealthy',
        latencyMs: r.latencyMs,
        httpStatus: r.httpStatus,
        probes: [probeTiming('Page response', baseUrl, r)],
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
            } else if (svc.name === 'aggregation' && dep.status === 'unknown') {
                issues.push({
                    severity: 'warning',
                    service: svc.name,
                    message: `Aggregation readiness for "${dep.name}" is unavailable${dep.detail ? ` (${dep.detail})` : ''}`,
                });
            }
        }
        if (svc.name === 'aggregation') issues.push(...queueWarnings(svc.queues ?? []));
        if (svc.queueStatsError) {
            issues.push({
                severity: 'warning',
                service: svc.name,
                message: `Queue statistics unavailable: ${svc.queueStatsError}`,
            });
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

export async function GET(request: Request): Promise<Response> {
    // Require an authenticated console session. This snapshot exposes internal
    // service URLs, versions, model inventory and env-var presence — admin-only
    // recon data — so anonymous callers are rejected, matching the sibling
    // restart/migrations routes.
    const accessToken = readCookie(request, ACCESS_COOKIE);
    if (!accessToken) {
        return Response.json({ message: 'Not authenticated' }, { status: 401 });
    }
    const start = performance.now();

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

    // Reuse the same CMS observation for the inventory and distributed role proof.
    const cmsCheck = checkCms(env.CMS_BASE_URL, request.signal);
    const settled = await Promise.allSettled([
        cmsCheck,
        checkIam(env.IAM_BASE_URL, request.signal),
        checkAggregation(env.AGGREGATION_BASE_URL, cmsCheck, request.signal, accessToken),
        checkEnrichment(env.ENRICHMENT_BASE_URL, request.signal),
        checkMedia(env.MEDIA_BASE_URL, request.signal),
        checkPlatform(env.PLATFORM_BASE_URL, request.signal),
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
        durationMs: Math.round(performance.now() - start),
        overall: computeOverall(services),
        services,
        envAudit,
        issues: collectIssues(services, envAudit),
    };

    return Response.json(snapshot);
}
