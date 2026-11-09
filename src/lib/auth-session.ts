import { authRequest, parseAuthError } from '@/lib/api/iam/auth';
import type { MeResponse } from '@/lib/api/iam/types';

const lockName = 'wahb-console-session';
const eventKey = 'wahb-console-session-change';

type Inspection =
    | { state: 'valid'; profile: MeResponse }
    | { state: 'expired' | 'signed_out' | 'unavailable' | 'runtime_changed' };

export type SessionResult =
    | { state: 'valid'; profile: MeResponse; refreshed: boolean }
    | { state: 'signed_out' | 'unavailable' | 'runtime_changed' };

let tail: Promise<unknown> = Promise.resolve();

export async function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (locks) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
            return await locks.request(lockName, { signal: controller.signal }, run);
        } finally {
            clearTimeout(timeout);
        }
    }
    const next = tail.then(run, run);
    tail = next.catch(() => undefined);
    return next;
}

type SessionChange = 'login' | 'logout';
let sessionChannel: BroadcastChannel | undefined;

export function notifySessionChange(kind: SessionChange) {
    if (sessionChannel) {
        sessionChannel.postMessage(kind);
        return;
    }
    try { localStorage.setItem(eventKey, `${kind}:${crypto.randomUUID()}`); } catch { /* optional storage */ }
}

export function onSessionChange(listener: (kind: SessionChange) => void) {
    let channel: BroadcastChannel | undefined;
    try {
        if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(eventKey);
    } catch { /* storage events remain available */ }
    sessionChannel = channel;
    if (channel) channel.onmessage = ({ data }) => {
        if (data === 'login' || data === 'logout') listener(data);
    };
    const onStorage = (event: StorageEvent) => {
        if (event.key === eventKey && event.newValue?.startsWith('logout:')) listener('logout');
        if (event.key === eventKey && event.newValue?.startsWith('login:')) listener('login');
    };
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener('storage', onStorage);
        channel?.close();
        if (sessionChannel === channel) sessionChannel = undefined;
    };
}

async function inspectSession(): Promise<Inspection> {
    const res = await authRequest('/api/auth/me', { timeout: 5_000 });
    if (res.ok) return { state: 'valid', profile: await res.json() };
    const { code } = await parseAuthError(res);
    if (code === 'runtime_changed') return { state: 'runtime_changed' };
    if (code === 'access_expired') return { state: 'expired' };
    if (code === 'no_session') return { state: 'signed_out' };
    return { state: 'unavailable' };
}

async function recover(): Promise<SessionResult> {
    const initial = await inspectSession();
    if (initial.state === 'valid') return { ...initial, refreshed: false };
    if (initial.state !== 'expired') return { state: initial.state };

    return withSessionLock(async () => {
        const current = await inspectSession();
        if (current.state === 'valid') return { ...current, refreshed: true };
        if (current.state !== 'expired') return { state: current.state };

        const refresh = await authRequest('/api/auth/refresh', { method: 'POST' });
        const rejection = refresh.ok ? undefined : await parseAuthError(refresh);
        if (rejection?.code === 'runtime_changed') return { state: 'runtime_changed' };
        if (rejection && rejection.code !== 'session_rejected' && rejection.code !== 'no_session') {
            return { state: 'unavailable' };
        }

        const verified = await inspectSession();
        if (verified.state === 'valid') return { ...verified, refreshed: true };
        if (verified.state !== 'expired') return { state: verified.state };
        return { state: rejection ? 'signed_out' : 'unavailable' };
    });
}

let inFlight: Promise<SessionResult> | undefined;
export function recoverSession(): Promise<SessionResult> {
    inFlight ??= recover().catch((): SessionResult => ({ state: 'unavailable' })).finally(() => {
        inFlight = undefined;
    });
    return inFlight;
}
