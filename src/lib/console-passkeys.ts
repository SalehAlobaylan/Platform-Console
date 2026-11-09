import { authRequest, parseAuthError } from './api/iam/auth';
import type { MeResponse } from './api/iam/types';
import { recoverSession, withSessionLock } from './auth-session';

export function canUsePasskeys() {
    return typeof PublicKeyCredential !== 'undefined' &&
        typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
        typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
        typeof PublicKeyCredential.prototype.toJSON === 'function';
}

async function request(path: string, body?: unknown) {
    const response = await authRequest('/api/auth/passkeys' + path, { body, timeout: 15_000 });
    if (!response.ok) throw await parseAuthError(response);
    return response;
}

async function requireSession() {
    const result = await recoverSession();
    if (result.state !== 'valid') throw new Error('Your session couldn’t be verified. Try again.');
}

export async function signInWithPasskey(): Promise<MeResponse> {
    const { publicKey } = await (await request('/authentication/begin', {})).json();
    const credential = await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(publicKey),
    });
    if (!(credential instanceof PublicKeyCredential)) throw new DOMException('No passkey selected', 'NotAllowedError');
    return withSessionLock(async () =>
        (await request('/authentication/finish', { credential: credential.toJSON() })).json());
}

export async function addPasskey(password: string) {
    await requireSession();
    const { publicKey } = await (await request('/registration/begin', { password })).json();
    const credential = await navigator.credentials.create({
        publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(publicKey),
    });
    if (!(credential instanceof PublicKeyCredential)) throw new DOMException('No passkey created', 'NotAllowedError');
    await requireSession();
    await request('/registration/finish', { credential: credential.toJSON() });
}

export type Passkey = { id: string; created_at: string; last_used_at?: string };

export async function listPasskeys(): Promise<Passkey[]> {
    await requireSession();
    return (await request('')).json();
}

export async function removePasskey(id: string, password: string) {
    await requireSession();
    await request('/remove', { id, password });
}
