/** @jest-environment node */
import { hasCurrentRuntimeSession, rejectInvalidRuntimeRequest } from '../runtime-session';

const previous = process.env.WAHB_RUNTIME_ID;
const url = 'http://localhost:3005/api/cms/admin/content';

afterEach(() => {
    if (previous === undefined) delete process.env.WAHB_RUNTIME_ID;
    else process.env.WAHB_RUNTIME_ID = previous;
});

it('rejects old cookies even when access credentials still exist', () => {
    process.env.WAHB_RUNTIME_ID = 'new-launch';
    expect(hasCurrentRuntimeSession(new Request(url, {
        headers: { cookie: 'console_runtime_id=old-launch; console_access_token=fixture' },
    }))).toBe(false);
    expect(hasCurrentRuntimeSession(new Request(url, {
        headers: { cookie: 'console_runtime_id=new-launch' },
    }))).toBe(true);
});

it('keeps unmanaged sessions compatible', () => {
    delete process.env.WAHB_RUNTIME_ID;
    expect(hasCurrentRuntimeSession(new Request(url))).toBe(true);
});

it('checks origin, document launch, and session cookie in order', () => {
    process.env.WAHB_RUNTIME_ID = 'new-launch';
    const headers = {
        origin: 'http://localhost:3005',
        'x-wahb-runtime-id': 'new-launch',
        cookie: 'console_runtime_id=new-launch',
    };
    const reject = (changes: Record<string, string>) =>
        rejectInvalidRuntimeRequest(new Request(url, { method: 'POST', headers: { ...headers, ...changes } }));
    expect(reject({ origin: 'http://other:3005', 'x-wahb-runtime-id': 'old-launch' })?.status).toBe(403);
    expect(reject({ 'x-wahb-runtime-id': 'old-launch' })?.status).toBe(409);
    expect(reject({ cookie: 'console_runtime_id=old-launch' })?.status).toBe(401);
    expect(reject({})).toBeUndefined();
});
