/** @jest-environment node */
import { GET } from './route';
import type {
  QueueDepth,
  SystemHealthSnapshot,
} from '@/types/platform/system-health';

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
const NOW = Date.parse('2026-11-02T08:00:00Z');

function ready(dependencies: Record<string, unknown> = {}, fields = {}) {
  return {
    schema_version: 'aggregation-role-readiness/v1',
    role: 'intake-control',
    status: 'ready',
    pod_ready: true,
    dependencies: {
      redis: 'connected',
      cms: 'reachable',
      workers: 'healthy',
      storage: 'reachable',
      ...dependencies,
    },
    reasons: [],
    ...fields,
  };
}

function owner(fields = {}) {
  return {
    state: 'ready',
    observed_at: new Date(NOW - 10_000).toISOString(),
    stale_after_at: new Date(NOW + 80_000).toISOString(),
    ...fields,
  };
}

function cms(aggregation: unknown = owner()) {
  return { status: 'ok', supply_owner_readiness: { aggregation } };
}

function queue(fields: Partial<QueueDepth> = {}): QueueDepth {
  return {
    queue: 'fetch-queue',
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    ...fields,
  };
}

interface StubResponse {
  body?: unknown;
  status?: number;
  error?: Error;
}

function stubFetch(overrides: Record<string, StubResponse> = {}) {
  const defaults: Record<string, StubResponse> = {
    'http://cms.test/health': { body: cms() },
    'http://iam.test/health': { body: { status: 'healthy' } },
    'http://aggregation.test/health': { body: { status: 'healthy' } },
    'http://aggregation.test/ready': { body: ready() },
    'http://aggregation.test/admin/queues': { body: [] },
    'http://enrichment.test/health': { body: { status: 'healthy' } },
    'http://enrichment.test/ready': { body: { models: { embedding: true } } },
    'http://media.test/health': { body: { status: 'healthy' } },
    'http://media.test/ready': { body: { models: { clip: true } } },
    'http://media.test/health/queue': {
      body: { configured: true, worker_alive: true },
    },
    'http://platform.test': { body: {} },
  };
  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const response = overrides[url] ?? defaults[url];
    if (!response) throw new Error(`Unexpected probe: ${url}`);
    if (response.error) throw response.error;
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
    });
  });
}

async function snapshot() {
  const response = await GET(new Request('http://console.test/api/system-health'));
  expect(response.status).toBe(200);
  const result = (await response.json()) as SystemHealthSnapshot;
  const aggregation = result.services.find(
    (service) => service.name === 'aggregation'
  )!;
  expect(aggregation).toBeDefined();
  return {
    result,
    aggregation,
    issues: result.issues.filter((issue) => issue.service === 'aggregation'),
  };
}

beforeEach(() => {
  keys.forEach((key) => delete process.env[key]);
  keys.forEach((key) => {
    process.env[key] =
      `http://${key.replace('_BASE_URL', '').toLowerCase()}.test`;
  });
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  stubFetch();
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = savedFetch;
});

test('healthy requires local readiness and current CMS aggregate role proof, sharing one CMS probe', async () => {
  const { result, aggregation, issues } = await snapshot();
  expect(aggregation.status).toBe('healthy');
  expect(
    aggregation.deps.find((dep) => dep.name === 'worker-topology')?.status
  ).toBe('healthy');
  expect(result.overall).toBe('healthy');
  expect(issues).toEqual([]);
  expect(
    (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === 'http://cms.test/health'
    )
  ).toHaveLength(1);
});

test.each([
  ['healthy', 'reachable', 200, 'healthy'],
  ['stale', 'reachable', 503, 'degraded'],
  ['missing', 'reachable', 503, 'degraded'],
  ['healthy', 'unreachable', 503, 'degraded'],
  ['new-contract-state', 'reachable', 200, 'unknown'],
])(
  'Aggregation readiness %s / %s stays truthful',
  async (workers, cmsState, http, expected) => {
    stubFetch({
      'http://aggregation.test/ready': {
        body: ready(
          { workers, cms: cmsState },
          http === 503 ? { status: 'not_ready', pod_ready: false } : {}
        ),
        status: http,
      },
    });
    const { aggregation } = await snapshot();
    expect(aggregation.status).toBe(expected);
    expect(aggregation.deps.find((dep) => dep.name === 'workers')?.status).toBe(
      workers === 'healthy'
        ? 'healthy'
        : workers === 'new-contract-state'
          ? 'unknown'
          : 'unhealthy'
    );
  }
);

test.each([
  ['retained failures', queue({ failed: 677 }), 'retains 677 failed job(s)'],
  ['processing backlog', queue({ waiting: 101 }), 'is backed up (101 waiting)'],
  [
    'dead-letter archive',
    queue({ queue: 'aggregation-dlq', waiting: 30580 }),
    'retains 30580 job(s) for investigation',
  ],
])(
  'keeps %s visible without degrading a ready service',
  async (_label, stats, message) => {
    stubFetch({ 'http://aggregation.test/admin/queues': { body: [stats] } });
    const { result, aggregation, issues } = await snapshot();
    expect(aggregation.status).toBe('healthy');
    expect(aggregation.queues).toEqual([stats]);
    expect(issues).toEqual([
      {
        severity: 'warning',
        service: 'aggregation',
        message: expect.stringContaining(message),
      },
    ]);
    expect(
      result.services.every((service) => service.status === 'healthy')
    ).toBe(true);
  }
);

test.each(['aggregation-dlq', 'news-stage-dlq', 'pods-stage-dlq'])(
  'labels %s as retained inventory even below the processing threshold',
  async (name) => {
    stubFetch({
      'http://aggregation.test/admin/queues': {
        body: [queue({ queue: name, waiting: 1 })],
      },
    });
    const { issues } = await snapshot();
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('for investigation');
    expect(issues[0].message).not.toContain('backed up');
  }
);

test('a service recovers while retained failures remain for investigation', async () => {
  const queues = { body: [queue({ failed: 5 })] };
  stubFetch({
    'http://aggregation.test/admin/queues': queues,
    'http://aggregation.test/ready': {
      body: ready(
        { workers: 'stale' },
        { pod_ready: false, status: 'not_ready' }
      ),
      status: 503,
    },
  });
  expect((await snapshot()).aggregation.status).toBe('degraded');
  stubFetch({ 'http://aggregation.test/admin/queues': queues });
  const { aggregation, issues } = await snapshot();
  expect(aggregation.status).toBe('healthy');
  expect(issues).toHaveLength(1);
  expect(issues[0].message).toContain('retains 5 failed job(s)');
});

test.each<[string, StubResponse]>([
  ['unauthorized', { status: 401, body: [] }],
  ['forbidden', { status: 403, body: [] }],
  ['server error', { status: 503, body: [] }],
  ['timeout', { error: new Error('probe timed out') }],
  ['object response', { body: {} }],
  ['empty response', {}],
  ['incomplete row', { body: [{ queue: 'fetch-queue' }] }],
  ['negative count', { body: [queue({ failed: -1 })] }],
  ['non-numeric count', { body: [{ ...queue(), waiting: '101' }] }],
  ['mixed valid and invalid rows', { body: [queue(), null] }],
])(
  'reports unavailable queue statistics explicitly: %s',
  async (_label, response) => {
    stubFetch({ 'http://aggregation.test/admin/queues': response });
    const { aggregation, issues } = await snapshot();
    expect(aggregation.status).toBe('healthy');
    expect(aggregation.queues).toBeUndefined();
    expect(aggregation.queueStatsError).toBeTruthy();
    expect(issues).toEqual([
      {
        severity: 'warning',
        service: 'aggregation',
        message: expect.stringContaining('Queue statistics unavailable:'),
      },
    ]);
  }
);

test.each([
  ['missing proof', null],
  ['not started', { state: 'not_started' }],
  [
    'unavailable required role',
    {
      state: 'stale',
      detail: 'one or more required Aggregation roles are unavailable',
    },
  ],
  ['expired proof', owner({ stale_after_at: new Date(NOW - 1).toISOString() })],
  [
    'future observation',
    owner({ observed_at: new Date(NOW + 10_000).toISOString() }),
  ],
  ['missing expiry', owner({ stale_after_at: null })],
  ['invalid timestamp', owner({ observed_at: 'invalid' })],
  ['unknown state', owner({ state: 'new-state' })],
  [
    'unbounded expiry',
    owner({ stale_after_at: new Date(NOW + 3600_000).toISOString() }),
  ],
])(
  'never infers complete role readiness from intake alone: %s',
  async (_label, evidence) => {
    stubFetch({ 'http://cms.test/health': { body: cms(evidence) } });
    const { aggregation, issues } = await snapshot();
    expect(aggregation.status).toBe('unknown');
    expect(
      aggregation.deps.find((dep) => dep.name === 'worker-topology')?.status
    ).toBe('unknown');
    expect(
      issues.some(
        (issue) =>
          issue.message.includes('worker-topology') &&
          issue.message.includes('unavailable')
      )
    ).toBe(true);
  }
);

test('unreachable CMS cannot leave aggregate role readiness green', async () => {
  stubFetch({
    'http://cms.test/health': { error: new Error('connection refused') },
  });
  expect((await snapshot()).aggregation.status).toBe('unknown');
});

test('missing CMS configuration cannot leave aggregate role readiness green', async () => {
  delete process.env.CMS_BASE_URL;
  expect((await snapshot()).aggregation.status).toBe('unknown');
});

test('unrelated CMS health failures do not erase its current independent owner proof', async () => {
  stubFetch({
    'http://cms.test/health': {
      status: 503,
      body: { ...cms(), status: 'degraded' },
    },
  });
  const { result, aggregation } = await snapshot();
  expect(
    result.services.find((service) => service.name === 'cms')?.status
  ).toBe('unhealthy');
  expect(aggregation.status).toBe('healthy');
});

test.each([
  ['missing body', null],
  ['missing dependencies', ready({}, { dependencies: {} })],
  ['missing pod verdict', ready({}, { pod_ready: undefined })],
  ['inconsistent verdict', ready({}, { pod_ready: false })],
  [
    'incompatible contract',
    ready({}, { schema_version: 'aggregation-role-readiness/v2' }),
  ],
])('treats unproven local readiness as unknown: %s', async (_label, body) => {
  stubFetch({ 'http://aggregation.test/ready': { body } });
  const { aggregation, issues } = await snapshot();
  expect(aggregation.status).toBe('unknown');
  expect(issues.some((issue) => issue.message.includes('readiness'))).toBe(
    true
  );
});

test('reports a failed startup hook even when dependency connections are healthy', async () => {
  stubFetch({
    'http://aggregation.test/ready': {
      status: 503,
      body: ready(
        {},
        {
          status: 'not_ready',
          pod_ready: false,
          reasons: ['startup hooks pending: discovery-sweeper'],
        }
      ),
    },
  });
  const { aggregation, issues } = await snapshot();
  expect(aggregation.status).toBe('degraded');
  expect(issues).toContainEqual({
    severity: 'critical',
    service: 'aggregation',
    message: expect.stringContaining(
      'startup hooks pending: discovery-sweeper'
    ),
  });
});

test('a readiness timeout remains unknown while liveness succeeds', async () => {
  stubFetch({
    'http://aggregation.test/ready': { error: new Error('probe timed out') },
  });
  expect((await snapshot()).aggregation.status).toBe('unknown');
});

test('both unavailable service endpoints remain unhealthy', async () => {
  stubFetch({
    'http://aggregation.test/health': {
      error: new Error('connection refused'),
    },
    'http://aggregation.test/ready': { error: new Error('connection refused') },
  });
  expect((await snapshot()).aggregation.status).toBe('unhealthy');
});

test('reports separate endpoint timings and total collection duration', async () => {
  const { result, aggregation } = await snapshot();
  expect(result.durationMs).toEqual(expect.any(Number));
  expect(aggregation.probes?.map(({ label, endpointUrl, httpStatus }) => ({ label, endpointUrl, httpStatus }))).toEqual([
    { label: 'Health', endpointUrl: 'http://aggregation.test/health', httpStatus: 200 },
    { label: 'Readiness', endpointUrl: 'http://aggregation.test/ready', httpStatus: 200 },
    { label: 'Queue statistics', endpointUrl: 'http://aggregation.test/admin/queues', httpStatus: 200 },
  ]);
  expect(aggregation.latencyMs).toBe(aggregation.probes?.[0].latencyMs);
});

test('measures the response body and consumes the frontend response', async () => {
  let elapsed = 0;
  jest.spyOn(performance, 'now').mockImplementation(() => elapsed);
  const fetchStub = global.fetch;
  const pageConsumed = jest.fn(async () => new ArrayBuffer(0));
  global.fetch = jest.fn(async (...args: Parameters<typeof fetch>) => {
    const response = await fetchStub(...args);
    if (String(args[0]) === 'http://cms.test/health') {
      const readBody = response.text.bind(response);
      response.text = async () => {
        elapsed = 75;
        return readBody();
      };
    }
    if (String(args[0]) === 'http://platform.test') response.arrayBuffer = pageConsumed;
    return response;
  });
  const { result } = await snapshot();
  expect(result.services.find(({ name }) => name === 'cms')?.latencyMs).toBe(75);
  expect(pageConsumed).toHaveBeenCalledTimes(1);
});

test('passes caller cancellation to every outgoing probe', async () => {
  const controller = new AbortController();
  const observedSignals: AbortSignal[] = [];
  const fetchStub = global.fetch;
  global.fetch = jest.fn(async (input, init) => {
    observedSignals.push(init!.signal as AbortSignal);
    return fetchStub(input, init);
  });
  controller.abort();
  await GET(new Request('http://console.test/api/system-health', { signal: controller.signal }));
  expect(observedSignals).toHaveLength(11);
  expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
});
