/** @jest-environment node */


import { GET } from './route';

const originalFetch = global.fetch;
const originalCmsUrl = process.env.CMS_BASE_URL;
const validID = '2b4da8db-8491-48b9-b5f9-667a097ddc79';

function request(path = `/api/operator/investigations/${validID}/events?after=4`, token?: string): Request {
  const value = new Request(`http://console.test${path}`, { headers: { 'x-request-id': 'request-1' } });
  if (token) value.headers.set('cookie', `console_access_token=${token}`);
  return value;
}

beforeEach(() => { process.env.CMS_BASE_URL = 'http://cms.test'; });
afterEach(() => { global.fetch = originalFetch; process.env.CMS_BASE_URL = originalCmsUrl; });

test('rejects malformed identifiers and cursors without CMS fetches', async () => {
  global.fetch = jest.fn();
  expect((await GET(request('/api/operator/investigations/not-a-uuid/events', 'session'), { params: Promise.resolve({ id: 'not-a-uuid' }) })).status).toBe(400);
  expect((await GET(request(`/api/operator/investigations/${validID}/events?after=-1`, 'session'), { params: Promise.resolve({ id: validID }) })).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('uses only the fixed CMS event path and cookie session', async () => {
  const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ investigation_id: validID, state: 'running', events: [], next_sequence: 4 }), { status: 200, headers: { 'content-type': 'application/json' } }));
  global.fetch = fetchMock;
  const response = await GET(request(undefined, 'session-token'), { params: Promise.resolve({ id: validID }) });
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe(`http://cms.test/admin/operator/investigations/${validID}/events?after=4`);
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get('authorization')).toBe('Bearer session-token');
});

test('rejects malformed successful upstream event payloads', async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ events: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
  expect((await GET(request(undefined, 'session-token'), { params: Promise.resolve({ id: validID }) })).status).toBe(502);
});
