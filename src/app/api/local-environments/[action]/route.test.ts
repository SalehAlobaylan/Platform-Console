/** @jest-environment node */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GET, POST } from './route';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const previousFetch = global.fetch;
const envKeys = [
  'WAHB_RUNTIME_ID',
  'MIGRATION_COORDINATOR_URL',
  'MIGRATION_COORDINATOR_READ_TOKEN',
] as const;
const previousEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]])
);
const database = {
  owner: 'cms',
  target: 'ep-fixture.neon.tech/neondb',
  state: 'ready',
  ledger: 'legacy_history',
  identity: {
    id: 'database',
    epoch: 0,
    fence: 'open',
    fence_epoch: 0,
    owner_state: 'running',
  },
  pending: [],
  issues: null,
  missing: [],
  warnings: ['Historical checksum limitation'],
  legacy_checksum_history: ['20260113000000_init.sql'],
  schema_digest: 'schema',
  dirty: false,
  version: 0,
  empty: false,
};
const report = {
  id: 'saved-report',
  environment: 'stable',
  config_revision: 'config',
  observed_at: '2026-10-03T00:00:00Z',
  state: 'ready',
  databases: [database],
  resources: [],
  build_digest: 'build',
  digest: 'saved-digest',
};
const overview = {
  profiles: [],
  selection: {
    schema_version: 1,
    revision: 0,
    default_environment: 'stable',
    updated_at: '2026-10-03T00:00:00Z',
    updated_by: 'operator',
  },
  runtime: null,
  last_successful: null,
  reports: { stable: report, sandbox: null },
};

function request(action: string, method = 'GET') {
  return new NextRequest(
    `http://localhost:3005/api/local-environments/${action}`,
    {
      method,
      headers: {
        Origin: 'http://localhost:3005',
        'X-Wahb-Runtime-ID': 'launch',
        'Content-Type': 'application/json',
      },
      ...(method === 'POST'
        ? { body: JSON.stringify({ environment: 'stable' }) }
        : {}),
    }
  );
}
function upstream(value: unknown, status = 200) {
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(value), { status }));
}

beforeEach(() => {
  process.env.WAHB_RUNTIME_ID = 'launch';
  process.env.MIGRATION_COORDINATOR_URL = 'http://coordinator.test';
  process.env.MIGRATION_COORDINATOR_READ_TOKEN = 'machine-token';
  jest.mocked(cookies).mockResolvedValue({
    get: (name: string) => ({
      value: name === 'console_runtime_id' ? 'launch' : 'operator-token',
    }),
  } as never);
});
afterEach(() => {
  global.fetch = previousFetch;
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

it('serves saved overview reports as arrays even to the original browser schema', async () => {
  upstream(overview);
  const response = await GET(request('overview'), {
    params: Promise.resolve({ action: 'overview' }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  const health = payload.reports.stable.databases[0];
  expect(
    z.object({ issues: z.array(z.string()) }).parse(health).issues
  ).toEqual([]);
  expect(payload.reports.stable.digest).toBe(report.digest);
  expect(health.warnings).toEqual(database.warnings);
  expect(payload.reports.sandbox).toBeNull();
  expect(report.databases[0].issues).toBeNull();
});

it.each(['inspect', 'plan'])(
  'normalizes %s evidence without changing review digests',
  async (action) => {
    const plan = {
      id: 'plan',
      environment: 'stable',
      report,
      steps: [],
      blocked: [],
      expires_at: '2026-10-03T01:00:00Z',
      digest: 'plan-digest',
    };
    upstream(action === 'plan' ? plan : report);
    const response = await POST(request(action, 'POST'), {
      params: Promise.resolve({ action }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    const evidence = action === 'plan' ? payload.report : payload;
    expect(evidence.databases[0].issues).toEqual([]);
    expect(evidence.digest).toBe(report.digest);
    if (action === 'plan') expect(payload.digest).toBe(plan.digest);
  }
);

it('retains genuine issues and refuses malformed successful evidence', async () => {
  upstream({
    ...overview,
    reports: {
      stable: {
        ...report,
        databases: [{ ...database, issues: ['Owner repair required'] }],
      },
    },
  });
  const context = { params: Promise.resolve({ action: 'overview' }) };
  const response = await GET(request('overview'), context);
  expect((await response.json()).reports.stable.databases[0].issues).toEqual([
    'Owner repair required',
  ]);
  upstream({
    ...overview,
    reports: {
      stable: { ...report, databases: [{ ...database, issues: 'invalid' }] },
    },
  });
  expect((await GET(request('overview'), context)).status).toBe(502);
});

it('preserves upstream authorization failures', async () => {
  upstream({ message: 'Current administrator authority is required' }, 403);
  const response = await GET(request('overview'), {
    params: Promise.resolve({ action: 'overview' }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    message: 'Current administrator authority is required',
  });
});

it('rejects an old runtime session before fetching any evidence', async () => {
  jest
    .mocked(cookies)
    .mockResolvedValue({ get: () => ({ value: 'old-launch' }) } as never);
  global.fetch = jest.fn();
  const response = await GET(request('overview'), {
    params: Promise.resolve({ action: 'overview' }),
  });
  expect(response.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
});
