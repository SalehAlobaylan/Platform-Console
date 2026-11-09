export function apiMethodFallbacks(...methods: Array<'GET' | 'POST'>) {
    // Start defers unhandled methods to page rendering. Keep the HTTP
    // contract of the previous API routes, including automatic OPTIONS.
    const allowed = [...methods, 'OPTIONS'];
    if (methods.includes('GET')) allowed.push('HEAD');
    const allow = allowed.sort().join(', ');
    return {
        OPTIONS: () => new Response(null, { status: 204, headers: { allow } }),
        ANY: () => new Response(null, { status: 405 }),
    };
}
