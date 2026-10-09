/** @jest-environment node */

import axios from 'axios';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { createProxyHandlers } from '../proxy';

jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-session' }) }) }));

const originalFetch = global.fetch;
const originalCmsURL = process.env.CMS_BASE_URL;
const id = '11111111-1111-4111-8111-111111111111';
const payload = JSON.stringify({ content_ids: [id], selection_reason: 'fresh start' });
const cms = createProxyHandlers('CMS_BASE_URL');
const responseData = { data: { run: { id, state: 'preview' }, counts: { selected_ids: 163 } } };
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const request = (path: string, method = 'POST') => new NextRequest(`http://console.test/api/cms/${path}`, {
  method, headers: { 'content-type': 'application/json', cookie: 'private-cookie=test', host: 'console.test' },
  ...(method !== 'GET' && { body: payload }),
});
const upstream = (status = 201) => ({
  status, data: new TextEncoder().encode(JSON.stringify(responseData)).buffer,
  headers: { 'content-type': 'application/json', 'content-length': '999' },
});

beforeEach(() => { process.env.CMS_BASE_URL = 'http://cms.test'; global.fetch = jest.fn(); });
afterEach(() => {
  jest.useRealTimers(); jest.restoreAllMocks(); global.fetch = originalFetch;
  process.env.CMS_BASE_URL = originalCmsURL;
});

it.each(['admin/pods-reset/plans', `admin/pods-reset/plans/${id}/execute`])('waits beyond five minutes for %s without replaying its POST', async (path) => {
  jest.useFakeTimers();
  const transport = jest.spyOn(axios, 'request').mockImplementation(() => new Promise((resolve) => {
    setTimeout(() => resolve(upstream()), 301_000);
  }));
  const result = cms.POST(request(path), context(path));
  await jest.advanceTimersByTimeAsync(300_000);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toMatchObject({
    timeout: 900_000, maxRedirects: 0, responseType: 'arraybuffer',
    headers: { authorization: 'Bearer test-session' },
  });
  const sent = transport.mock.calls[0][0]!;
  expect(sent.data).toEqual(Buffer.from(payload));
  expect(sent.headers).not.toHaveProperty('cookie');
  expect(sent.headers).not.toHaveProperty('host');
  await jest.advanceTimersByTimeAsync(1_000);
  const response = await result;
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(responseData);
  expect(response.headers.has('content-length')).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(transport).toHaveBeenCalledTimes(1);
});

it('uses the real HTTP adapter with exact body/auth and returns compressed CMS responses correctly', async () => {
  let calls = 0;
  const owner = createServer(async (incoming, outgoing) => {
    calls++;
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    expect(incoming.url).toBe('/admin/pods-reset/plans');
    expect(incoming.headers.authorization).toBe('Bearer test-session');
    expect(incoming.headers.cookie).toBeUndefined();
    expect(Buffer.concat(chunks).toString()).toBe(payload);
    const compressed = gzipSync(JSON.stringify(responseData));
    outgoing.writeHead(201, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': compressed.length });
    outgoing.end(compressed);
  });
  await new Promise<void>((resolve) => owner.listen(0, '127.0.0.1', resolve));
  const address = owner.address();
  if (!address || typeof address === 'string') throw new Error('fixture did not bind');
  process.env.CMS_BASE_URL = `http://127.0.0.1:${address.port}`;
  try {
    const response = await cms.POST(request('admin/pods-reset/plans'), context('admin/pods-reset/plans'));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(responseData);
    expect(response.headers.has('content-encoding')).toBe(false);
    expect(response.headers.has('content-length')).toBe(false);
    expect(calls).toBe(1);
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    owner.closeAllConnections();
    await new Promise<void>((resolve, reject) => owner.close((error) => error ? reject(error) : resolve()));
  }
});

it('returns an actual CMS refusal rather than replacing it with a proxy failure', async () => {
  const transport = jest.spyOn(axios, 'request').mockResolvedValue({ ...upstream(409), data: Buffer.from('{"error":"selection changed"}') });
  const response = await cms.POST(request('admin/pods-reset/plans'), context('admin/pods-reset/plans'));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'selection changed' });
  expect(transport.mock.calls[0][0]?.validateStatus?.(409)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([['ECONNABORTED', 504, 'pods_reset_proxy_timeout'], ['ECONNREFUSED', 502, 'pods_reset_proxy_unavailable']])('reports %s without exposing raw transport details or retrying', async (code, status, expectedCode) => {
  const transport = jest.spyOn(axios, 'request').mockRejectedValue(Object.assign(new Error('private-token private-url'), { isAxiosError: true, code }));
  const response = await cms.POST(request('admin/pods-reset/plans'), context('admin/pods-reset/plans'));
  expect(response.status).toBe(status);
  const result = await response.json();
  expect(result.code).toBe(expectedCode);
  expect(result.message).toContain('Run history');
  expect(JSON.stringify(result)).not.toContain('private');
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each(['admin/content', `admin/pods-reset/plans/${id}/approve`])('keeps the existing fetch path for %s', async (path) => {
  jest.spyOn(axios, 'request');
  global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const response = await cms.POST(request(path), context(path));
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(axios.request).not.toHaveBeenCalled();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('does not change GETs or the other service proxies', async () => {
  const transport = jest.spyOn(axios, 'request');
  global.fetch = jest.fn().mockResolvedValue(new Response('{}'));
  await cms.GET(request('admin/pods-reset/plans', 'GET'), context('admin/pods-reset/plans'));
  process.env.IAM_BASE_URL = 'http://iam.test';
  try {
    await createProxyHandlers('IAM_BASE_URL').POST(request('admin/pods-reset/plans'), context('admin/pods-reset/plans'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(transport).not.toHaveBeenCalled();
  } finally { delete process.env.IAM_BASE_URL; }
});
