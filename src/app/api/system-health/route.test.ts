/** @jest-environment node */
import { GET } from './route';
import type { SystemHealthSnapshot } from '@/types/platform/system-health';

jest.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'test-session' }) }),
}));
const keys = [
  'CMS_BASE_URL',
  'IAM_BASE_URL',
  'AGGREGATION_BASE_URL',
  'ENRICHMENT_BASE_URL',
  'MEDIA_BASE_URL',
  'PLATFORM_BASE_URL',
];
const savedEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const savedFetch = global.fetch;

beforeEach(() => {
  keys.forEach((key) => delete process.env[key]);
  process.env.AGGREGATION_BASE_URL = 'http://aggregation.test';
});
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = savedFetch;
});

test.each([
  ['healthy', 'reachable', 200, 'healthy'],
  ['stale', 'reachable', 503, 'degraded'],
  ['healthy', 'unreachable', 503, 'degraded'],
  ['new-contract-state', 'reachable', 200, 'degraded'],
])(
  'Aggregation readiness %s / %s stays truthful in the snapshot',
  async (workers, cms, http, expected) => {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/ready')
        ? { dependencies: { workers, cms, redis: 'connected' } }
        : url.endsWith('/admin/queues')
          ? []
          : { status: 'ok' };
      return new Response(JSON.stringify(body), {
        status: url.endsWith('/ready') ? Number(http) : 200,
      });
    });
    const response = await GET();
    const snapshot = (await response.json()) as SystemHealthSnapshot;
    const aggregation = snapshot.services.find(
      (service) => service.name === 'aggregation'
    );
    expect(aggregation?.status).toBe(expected);
    expect(
      aggregation?.deps.find((dep) => dep.name === 'workers')?.status
    ).toBe(
      workers === 'healthy'
        ? 'healthy'
        : workers === 'stale'
          ? 'unhealthy'
          : 'unknown'
    );
    expect(
      snapshot.issues.some((issue) =>
        issue.message.includes('unhealthy (healthy)')
      )
    ).toBe(false);
  }
);
