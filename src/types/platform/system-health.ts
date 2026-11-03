export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type ServiceName = 'cms' | 'iam' | 'aggregation' | 'enrichment' | 'media' | 'platform';

export interface DependencyHealth {
    name: string;
    status: ServiceStatus;
    detail?: string;
}

export interface QueueDepth {
    queue: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

export interface ModelLoad {
    name: string;
    loaded: boolean;
    detail?: string;
}

/**
 * Async-transcription worker health for Media-Service. The worker is a separate
 * deployment with no HTTP port; the Media API observes it through the shared
 * arq queue (Redis db=2) and reports it via /health/queue.
 */
export interface WorkerHealth {
    configured: boolean;
    alive: boolean;
    queued: number;
    ongoing: number;
    complete: number;
    failed: number;
    retried: number;
}

export interface ServiceHealth {
    name: ServiceName;
    displayName: string;
    endpointUrl: string;
    status: ServiceStatus;
    latencyMs: number | null;
    httpStatus: number | null;
    probes?: ServiceProbe[];
    version?: string;
    deps: DependencyHealth[];
    queues?: QueueDepth[];
    queueStatsError?: string;
    models?: ModelLoad[];
    worker?: WorkerHealth;
    rawError?: string;
    raw?: unknown;
}

export interface ServiceProbe {
    label: string;
    endpointUrl: string;
    latencyMs: number | null;
    httpStatus: number | null;
    error?: string;
}

export interface EnvAuditEntry {
    key: string;
    present: boolean;
}

export type IssueSeverity = 'critical' | 'warning';

export interface SystemIssue {
    severity: IssueSeverity;
    service?: ServiceName;
    message: string;
}

export interface SystemHealthSnapshot {
    timestamp: string;
    durationMs?: number;
    overall: ServiceStatus;
    services: ServiceHealth[];
    envAudit: EnvAuditEntry[];
    issues: SystemIssue[];
}
