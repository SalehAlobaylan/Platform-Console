import {
  dependencyStatus,
  healthHeadline,
  postgresStatus,
  snapshotIsStale,
} from '..';
import type {
  ServiceHealth,
  SystemHealthSnapshot,
} from '@/types/platform/system-health';

const service: ServiceHealth = {
  name: 'cms',
  displayName: 'CMS',
  endpointUrl: '',
  status: 'healthy',
  httpStatus: 200,
  latencyMs: 10,
  deps: [{ name: 'postgres', status: 'healthy' }],
};
const snapshot: SystemHealthSnapshot = {
  timestamp: '2026-09-22T16:00:00Z',
  overall: 'healthy',
  services: [service],
  issues: [],
  envAudit: [],
};

describe('health evidence', () => {
  test.each([
    'healthy',
    'connected',
    'reachable',
    'configured',
    'ready',
    'ok',
    'true',
    true,
    ' HEALTHY ',
  ])('recognizes affirmative readiness %s', (value) => {
    expect(dependencyStatus(value)).toBe('healthy');
  });
  test.each([
    'unhealthy',
    'disconnected',
    'unreachable',
    'not configured',
    'not ready',
    'stale',
    'missing',
    false,
  ])('never treats %s as healthy', (value) => {
    expect(dependencyStatus(value)).toBe('unhealthy');
  });
  test.each([null, undefined, 'new-state', {}])(
    'preserves unknown readiness %s',
    (value) => {
      expect(dependencyStatus(value)).toBe('unknown');
    }
  );
  it('does not infer both databases are healthy from just CMS', () => {
    expect(postgresStatus([service])).toBe('unknown');
    expect(postgresStatus([service, { ...service, name: 'iam' }])).toBe(
      'healthy'
    );
    expect(
      postgresStatus([
        { ...service, deps: [{ name: 'postgres', status: 'unhealthy' }] },
      ])
    ).toBe('unhealthy');
  });
  it('does not show a healthy headline when a reachable service reports warnings', () => {
    expect(
      healthHeadline(
        {
          ...snapshot,
          issues: [{ severity: 'warning', message: 'Queue has failed jobs' }],
        },
        false,
        false
      ).status
    ).toBe('degraded');
  });
  it('keeps empty, failed and stale evidence distinct from a healthy result', () => {
    expect(
      healthHeadline({ ...snapshot, services: [] }, false, false).status
    ).toBe('unknown');
    expect(healthHeadline(undefined, false, true).title).toBe(
      'Service checks unavailable'
    );
    expect(healthHeadline(snapshot, true, true).title).toBe(
      'Health data is out of date'
    );
    expect(healthHeadline(snapshot, false, false).status).toBe('healthy');
  });
  it('expires snapshots after three missed probe intervals', () => {
    expect(
      snapshotIsStale(snapshot, Date.parse(snapshot.timestamp) + 46_000)
    ).toBe(true);
    expect(
      snapshotIsStale(snapshot, Date.parse(snapshot.timestamp) + 15_000)
    ).toBe(false);
    expect(
      snapshotIsStale({ ...snapshot, timestamp: 'invalid' }, Date.now())
    ).toBe(true);
  });
});
