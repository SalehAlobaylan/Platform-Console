export function signInLocation(href: string, runtimeChanged = false) {
    const search = new URLSearchParams({ returnTo: href });
    if (runtimeChanged) search.set('reason', 'runtime_changed');
    return '/login?' + search.toString();
}

export function safeReturnTo(value: unknown, isProtected: (pathname: string) => boolean): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
        /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
    try {
        const target = new URL(value, 'https://console.invalid');
        if (target.origin === 'https://console.invalid' && isProtected(target.pathname)) {
            return target.pathname + target.search + target.hash;
        }
    } catch { /* an invalid destination returns to the dashboard */ }
    return '/';
}
