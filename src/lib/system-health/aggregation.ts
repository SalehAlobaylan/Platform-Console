import { dependencyStatus } from './index';
import type {
  DependencyHealth,
  QueueDepth,
  SystemIssue,
} from '@/types/platform/system-health';

const QUEUE_WAITING_WARN = 100;
const OWNER_EVIDENCE_MAX_AGE_MS = 90_000;
const CLOCK_SKEW_MS = 5_000;
const DEAD_LETTER_QUEUES = new Set([
  'aggregation-dlq',
  'news-stage-dlq',
  'pods-stage-dlq',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** CMS already validates the distributed topology; Console consumes its cached proof. */
function topologyDependency(value: unknown, now: number): DependencyHealth {
  const evidence = record(value);
  const observed =
    typeof evidence?.observed_at === 'string'
      ? Date.parse(evidence.observed_at)
      : NaN;
  const expires =
    typeof evidence?.stale_after_at === 'string'
      ? Date.parse(evidence.stale_after_at)
      : NaN;
  const fresh =
    Number.isFinite(observed) &&
    Number.isFinite(expires) &&
    observed <= now + CLOCK_SKEW_MS &&
    now - observed <= OWNER_EVIDENCE_MAX_AGE_MS &&
    expires > now &&
    expires > observed &&
    expires - observed <= OWNER_EVIDENCE_MAX_AGE_MS;

  return {
    name: 'worker-topology',
    status: fresh && evidence?.state === 'ready' ? 'healthy' : 'unknown',
    detail:
      fresh && evidence?.state === 'ready'
        ? 'All required Aggregation roles are ready (CMS /health)'
        : typeof evidence?.detail === 'string' && evidence.detail
          ? evidence.detail
          : 'Current Aggregation role readiness is unavailable from CMS /health',
  };
}

export function aggregationDependencies(
  ready: { ok: boolean; body: unknown },
  topology: unknown,
  now: number
): DependencyHealth[] {
  const body = record(ready.body);
  const values = record(body?.dependencies);
  const names = new Set([
    'redis',
    'cms',
    'workers',
    'storage',
    ...Object.keys(values ?? {}),
  ]);
  const deps = [...names].map(
    (name): DependencyHealth => ({
      name,
      status: dependencyStatus(values?.[name]),
      detail:
        values?.[name] == null
          ? 'Not reported by Aggregation /ready'
          : String(values[name]),
    })
  );

  const knownContract =
    body?.schema_version === 'aggregation-role-readiness/v1';
  const isReady =
    knownContract &&
    ready.ok &&
    body.pod_ready === true &&
    body.status === 'ready';
  const notReady =
    knownContract && body.pod_ready === false && body.status === 'not_ready';
  const reasons = Array.isArray(body?.reasons)
    ? body.reasons
        .filter((reason): reason is string => typeof reason === 'string')
        .join('; ')
    : '';
  deps.push({
    name: 'role-readiness',
    status: isReady ? 'healthy' : notReady ? 'unhealthy' : 'unknown',
    detail:
      reasons ||
      (isReady
        ? 'Local Aggregation role is ready'
        : notReady
          ? 'Local Aggregation role is not ready'
          : 'Local role readiness is unavailable or incompatible'),
  });
  deps.push(topologyDependency(topology, now));
  return deps;
}

/** Reject incomplete observations instead of silently dropping malformed rows. */
export function parseQueueStats(value: unknown): QueueDepth[] | undefined {
  const counts = [
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
  ] as const;
  if (
    !Array.isArray(value) ||
    !value.every((row) => {
      const queue = record(row);
      return (
        queue &&
        typeof queue.queue === 'string' &&
        queue.queue.trim().length > 0 &&
        counts.every(
          (key) =>
            typeof queue[key] === 'number' &&
            Number.isSafeInteger(queue[key]) &&
            queue[key] >= 0
        )
      );
    })
  )
    return undefined;
  return value as QueueDepth[];
}

/** Queue inventory is operational attention, independent of process readiness. */
export function queueWarnings(queues: QueueDepth[]): SystemIssue[] {
  return queues.flatMap((queue) => {
    const messages: string[] = [];
    if (DEAD_LETTER_QUEUES.has(queue.queue)) {
      const retained =
        queue.waiting + queue.active + queue.delayed + queue.failed;
      if (retained > 0)
        messages.push(
          `Dead-letter queue "${queue.queue}" retains ${retained} job(s) for investigation`
        );
    } else {
      if (queue.failed > 0)
        messages.push(
          `Queue "${queue.queue}" retains ${queue.failed} failed job(s)`
        );
      if (queue.waiting > QUEUE_WAITING_WARN)
        messages.push(
          `Queue "${queue.queue}" is backed up (${queue.waiting} waiting)`
        );
    }
    return messages.map((message) => ({
      severity: 'warning' as const,
      service: 'aggregation' as const,
      message,
    }));
  });
}
