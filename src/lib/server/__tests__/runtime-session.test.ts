import { hasCurrentRuntimeSession, sameOrigin } from '../runtime-session';

describe('managed runtime session boundary', () => {
  const previous = process.env.WAHB_RUNTIME_ID;
  afterEach(() => {
    if (previous === undefined) delete process.env.WAHB_RUNTIME_ID;
    else process.env.WAHB_RUNTIME_ID = previous;
  });
  it('rejects old cookies even when access credentials still exist', () => {
    process.env.WAHB_RUNTIME_ID = 'new-launch';
    const store = {
      get: (name: string) => ({
        value: name === 'console_runtime_id' ? 'old-launch' : 'valid-token',
      }),
    };
    expect(hasCurrentRuntimeSession(store as never)).toBe(false);
    expect(
      hasCurrentRuntimeSession({
        get: () => ({ value: 'new-launch' }),
      } as never)
    ).toBe(true);
  });
  it('keeps unmanaged deployments compatible', () => {
    delete process.env.WAHB_RUNTIME_ID;
    expect(hasCurrentRuntimeSession({ get: () => undefined } as never)).toBe(
      true
    );
  });
  it('requires an exact origin for browser mutations', () => {
    expect(
      sameOrigin({
        url: 'http://localhost:3005/api/action',
        headers: { get: () => 'http://localhost:3005' },
      } as unknown as Request)
    ).toBe(true);
    expect(
      sameOrigin({
        url: 'http://localhost:3005/api/action',
        headers: { get: () => 'http://other:3005' },
      } as unknown as Request)
    ).toBe(false);
    expect(
      sameOrigin({
        url: 'http://localhost:3005/api/action',
        headers: { get: () => null },
      } as unknown as Request)
    ).toBe(false);
  });
});
