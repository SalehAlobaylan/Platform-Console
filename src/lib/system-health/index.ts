import type {
  ServiceHealth,
  ServiceName,
  ServiceStatus,
  SystemHealthSnapshot,
} from '@/types/platform/system-health';

export const SERVICE_ROLES: Record<ServiceName, string> = {
  cms: 'Feeds, content & platform APIs',
  iam: 'Sign-in & access control',
  aggregation: 'Source ingestion & processing',
  enrichment: 'Text intelligence & embeddings',
  media: 'Transcription & image intelligence',
  platform: 'Consumer web application',
};

export const STATUS_ORDER: Record<ServiceStatus, number> = {
  unhealthy: 0,
  degraded: 1,
  unknown: 2,
  healthy: 3,
};

/** Readiness values are complete tokens: "disconnected" must not match "connected". */
export function dependencyStatus(value: unknown): ServiceStatus {
  if (value === true) return 'healthy';
  if (value === false) return 'unhealthy';
  if (typeof value !== 'string') return 'unknown';
  const status = value.trim().toLowerCase();
  if (
    [
      'healthy',
      'connected',
      'reachable',
      'configured',
      'ready',
      'ok',
      'true',
    ].includes(status)
  )
    return 'healthy';
  if (
    [
      'unhealthy',
      'disconnected',
      'unreachable',
      'not configured',
      'not ready',
      'error',
      'failed',
      'false',
      'unavailable',
      'down',
      'stale',
      'missing',
    ].includes(status)
  )
    return 'unhealthy';
  if (status === 'degraded') return 'degraded';
  return 'unknown';
}

export function postgresStatus(services: ServiceHealth[]): ServiceStatus {
  const statuses = (['cms', 'iam'] as const).map(
    (name) =>
      services
        .find((service) => service.name === name)
        ?.deps.find((dep) => dep.name.toLowerCase() === 'postgres')?.status ??
      'unknown'
  );
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('unknown')) return 'unknown';
  return 'healthy';
}

export function snapshotIsStale(
  snapshot: SystemHealthSnapshot,
  now: number
): boolean {
  const captured = Date.parse(snapshot.timestamp);
  return !Number.isFinite(captured) || now - captured > 45_000;
}

export function healthHeadline(
  snapshot: SystemHealthSnapshot | undefined,
  stale: boolean,
  failed: boolean
) {
  if (!snapshot)
    return {
      title: failed ? 'Service checks unavailable' : 'Checking services',
      status: 'unknown' as ServiceStatus,
    };
  if (stale)
    return {
      title: 'Health data is out of date',
      status: 'unknown' as ServiceStatus,
    };
  if (
    snapshot.overall === 'unhealthy' ||
    snapshot.services.some((s) => s.status === 'unhealthy') ||
    snapshot.issues.some((i) => i.severity === 'critical')
  ) {
    return {
      title: 'Service checks need attention',
      status: 'unhealthy' as ServiceStatus,
    };
  }
  if (
    snapshot.services.length === 0 ||
    snapshot.services.some((s) => s.status === 'unknown')
  ) {
    return {
      title: 'Service checks incomplete',
      status: 'unknown' as ServiceStatus,
    };
  }
  if (
    snapshot.overall === 'degraded' ||
    snapshot.services.some((s) => s.status === 'degraded') ||
    snapshot.issues.length > 0
  ) {
    return {
      title: 'Review service warnings',
      status: 'degraded' as ServiceStatus,
    };
  }
  if (snapshot.overall === 'unknown')
    return {
      title: 'Service checks incomplete',
      status: 'unknown' as ServiceStatus,
    };
  return {
    title: 'Service checks healthy',
    status: 'healthy' as ServiceStatus,
  };
}
