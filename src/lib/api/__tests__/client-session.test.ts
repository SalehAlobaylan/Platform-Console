import { AxiosError, type AxiosAdapter } from 'axios';
import { createClient, setErrorHandlers } from '../client';
import { QueryClient } from '@tanstack/react-query';
import { retryQuery } from '../query-retry';

jest.mock('@/lib/stores/auth', () => ({ clearAuthState: jest.fn() }));

describe('backend rejection versus Console session expiry', () => {
  const previousFetch = global.fetch;
  const on401 = jest.fn();
  let adapter: jest.MockedFunction<AxiosAdapter>;

  beforeEach(async () => {
    // Let the previous request's shared refresh promise retire.
    await new Promise((resolve) => setTimeout(resolve, 0));
    on401.mockReset();
    setErrorHandlers({ on401 });
    adapter = jest.fn(async (config) => {
      throw new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: { message: 'Invalid token audience' },
        }
      );
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = previousFetch;
  });

  it('keeps a valid IAM session without refreshing or retrying a backend rejection', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({
      status: 401,
      code: 'upstream_authentication_failed',
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(on401).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/me',
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a confirmed backend authentication rejection through query retries', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 } },
    });
    try {
      const client = createClient('/api/aggregation');
      await expect(
        queries.fetchQuery({
          queryKey: ['queues'],
          queryFn: () => client.post('/admin/test', {}, { adapter }),
        })
      ).rejects.toMatchObject({ code: 'upstream_authentication_failed' });
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(on401).not.toHaveBeenCalled();
    } finally {
      queries.clear();
    }
  });

  it('retains the existing single query retry for transient failures', async () => {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 } },
    });
    const request = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ success: true });
    try {
      await expect(
        queries.fetchQuery({ queryKey: ['transient'], queryFn: request })
      ).resolves.toEqual({ success: true });
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      queries.clear();
    }
  });

  it('clears a session that IAM rejects', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({ status: 401 });
    expect(on401).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('keeps session state when refresh and session inspection are unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({ status: 401 });
    expect(on401).not.toHaveBeenCalled();
  });
  function successful(config: Parameters<AxiosAdapter>[0]) {
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { success: true },
    };
  }

  function pendingResponse() {
    let resolve!: (value: { ok: boolean; status: number }) => void;
    const promise = new Promise<{ ok: boolean; status: number }>((complete) => {
      resolve = complete;
    });
    return { promise, resolve };
  }

  function waitForAbort(_input: unknown, init?: RequestInit): Promise<never> {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new Error('Aborted')),
        { once: true }
      );
    });
  }

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('adds no authentication requests to successful calls', async () => {
    global.fetch = jest.fn();
    adapter.mockImplementation(async (config) => successful(config));
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).resolves.toEqual({ success: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes a genuinely expired access token and retries once', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    adapter
      .mockImplementationOnce(async (config) => {
        throw new AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
            data: {},
          }
        );
      })
      .mockImplementationOnce(async (config) => successful(config));
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).resolves.toEqual({ success: true });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST' })
    );
    expect(on401).not.toHaveBeenCalled();
  });

  it('stops retrying a backend rejection after refresh and valid session readback', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({
      status: 401,
      code: 'upstream_authentication_failed',
    });
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(on401).not.toHaveBeenCalled();
  });

  it('retains session state when refresh is unavailable during an outage', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(
      createClient('/api/aggregation').post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({ status: 401 });
    expect(on401).not.toHaveBeenCalled();
  });

  it('shares one session check across 32 simultaneous failures from different clients', async () => {
    const session = pendingResponse();
    global.fetch = jest.fn().mockReturnValue(session.promise);
    const clients = [
      createClient('/api/aggregation'),
      createClient('/api/cms'),
    ];
    const outcomes = Promise.allSettled(
      Array.from({ length: 32 }, (_, i) =>
        clients[i % clients.length].post('/admin/test', {}, { adapter })
      )
    );
    await tick();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    session.resolve({ ok: true, status: 200 });
    const results = await outcomes;
    expect(
      results.every(
        (r) =>
          r.status === 'rejected' &&
          r.reason.code === 'upstream_authentication_failed'
      )
    ).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(32);
    expect(on401).not.toHaveBeenCalled();
  });

  it('shares one refresh across 32 simultaneous expired-token failures', async () => {
    const session = pendingResponse(),
      refresh = pendingResponse();
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(session.promise)
      .mockReturnValueOnce(refresh.promise);
    adapter.mockImplementation(async (config) => {
      if ((config as typeof config & { _retried?: boolean })._retried)
        return successful(config);
      throw new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: {},
        }
      );
    });
    const clients = [
      createClient('/api/aggregation'),
      createClient('/api/cms'),
    ];
    const outcomes = Promise.all(
      Array.from({ length: 32 }, (_, i) =>
        clients[i % clients.length].post('/admin/test', {}, { adapter })
      )
    );
    await tick();
    session.resolve({ ok: false, status: 401 });
    await tick();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    refresh.resolve({ ok: true, status: 200 });
    expect(await outcomes).toHaveLength(32);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(adapter).toHaveBeenCalledTimes(64);
    expect(on401).not.toHaveBeenCalled();
  });

  it('rechecks later failures instead of caching a previously valid session', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    const client = createClient('/api/aggregation');
    await expect(
      client.post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({ code: 'upstream_authentication_failed' });
    await expect(
      client.post('/admin/test', {}, { adapter })
    ).rejects.toMatchObject({ status: 401 });
    expect(on401).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('bounds session inspection at five seconds without signing out', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(waitForAbort);
    const outcome = createClient('/api/aggregation')
      .post('/admin/test', {}, { adapter })
      .catch((error) => error);
    await jest.advanceTimersByTimeAsync(0);
    const signal = (global.fetch as jest.Mock).mock.calls[0][1]
      .signal as AbortSignal;
    await jest.advanceTimersByTimeAsync(4999);
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    expect(await outcome).toMatchObject({ status: 401 });
    expect(on401).not.toHaveBeenCalled();
  });

  it('bounds refresh at ten seconds without inferring refresh-token expiry', async () => {
    jest.useFakeTimers();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockImplementationOnce(waitForAbort);
    const outcome = createClient('/api/aggregation')
      .post('/admin/test', {}, { adapter })
      .catch((error) => error);
    await jest.advanceTimersByTimeAsync(0);
    const signal = (global.fetch as jest.Mock).mock.calls[1][1]
      .signal as AbortSignal;
    await jest.advanceTimersByTimeAsync(10000);
    expect(signal.aborted).toBe(true);
    expect(await outcome).toMatchObject({ status: 401 });
    expect(on401).not.toHaveBeenCalled();
  });
});
