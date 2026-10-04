import type { cookies } from 'next/headers';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
export const RUNTIME_COOKIE = 'console_runtime_id';
export function currentRuntimeID(): string {
  return process.env.WAHB_RUNTIME_ID || '';
}
export function hasCurrentRuntimeSession(store: CookieStore): boolean {
  const runtime = currentRuntimeID();
  return !runtime || store.get(RUNTIME_COOKIE)?.value === runtime;
}
export function bindRuntimeSession(store: CookieStore): void {
  const runtime = currentRuntimeID();
  if (runtime)
    store.set(RUNTIME_COOKIE, runtime, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600,
    });
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}
