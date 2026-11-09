/** @jest-environment node */


import { POST } from './route';

const originalFetch = global.fetch;
const originalEnv = {
  IAM_BASE_URL: process.env.IAM_BASE_URL,
  ENRICHMENT_BASE_URL: process.env.ENRICHMENT_BASE_URL,
  ENRICHMENT_RESTART_TOKEN: process.env.ENRICHMENT_RESTART_TOKEN,
};

function restartRequest(body = { service: 'enrichment' }, token?: string): Request {
  const request = new Request('http://console.test/api/system-health/restart', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-request-id': 'request-123' },
  });
  if (token) request.headers.set('cookie', `console_access_token=${token}`);
  return request;
}

beforeEach(() => {
  process.env.IAM_BASE_URL = 'http://iam.test';
  process.env.ENRICHMENT_BASE_URL = 'http://enrichment.test';
  process.env.ENRICHMENT_RESTART_TOKEN = 'restart-capability';
});

afterEach(() => {
  global.fetch = originalFetch;
  Object.assign(process.env, originalEnv);
});

test('rejects restart requests without an authenticated session before parsing the body', async () => {
  global.fetch = jest.fn();

  const response = await POST(restartRequest({ service: 'not-a-service' }));

  expect(response.status).toBe(401);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects a valid non-admin IAM session', async () => {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ email: 'editor@example.test', roles: ['editor'] }), { status: 200 })
  );

  const response = await POST(restartRequest(undefined, 'editor-session'));

  expect(response.status).toBe(403);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('forwards only the dedicated restart capability after IAM authorizes an admin', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ email: 'admin@example.test', roles: ['admin'] }), { status: 200 })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ service: 'enrichment' }), { status: 202 })
    );
  global.fetch = fetchMock;

  const response = await POST(restartRequest(undefined, 'admin-session'));

  expect(response.status).toBe(202);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
  const headers = new Headers(init.headers);
  expect(headers.get('authorization')).toBe('Bearer restart-capability');
  expect(headers.get('x-operator-email')).toBe('admin@example.test');
  expect(headers.get('x-request-id')).toBe('request-123');
});
