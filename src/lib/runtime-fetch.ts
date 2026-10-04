'use client';
// Captured in the browser bundle, so a tab opened before a restart keeps the
// old value even if another tab signs in with new cookies.
const runtime = process.env.NEXT_PUBLIC_WAHB_RUNTIME_ID;
if (runtime && typeof window !== 'undefined') {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const target = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.href
    );
    if (
      target.origin !== window.location.origin ||
      !target.pathname.startsWith('/api/')
    )
      return original(input, init);
    const headers = new Headers(
      input instanceof Request ? input.headers : undefined
    );
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set('X-Wahb-Runtime-ID', runtime);
    const response = await original(input, { ...init, headers });
    if (response.status === 409) {
      const value = await response
        .clone()
        .json()
        .catch(() => null);
      if (value?.code === 'runtime_changed') window.location.assign('/login');
    }
    return response;
  };
}
