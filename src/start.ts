import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { rejectInvalidRuntimeRequest } from '@/lib/server/runtime-session';

const apiMethods = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']);

const consoleRequests = createMiddleware().server(async ({ request, next }) => {
    // Private API responses and the launch ID embedded in the initial document
    // must be revalidated after a restart. Static assets are served separately.
    setResponseHeader('cache-control', 'private, no-store');
    const rejection = rejectInvalidRuntimeRequest(request);
    if (rejection) return rejection;
    if (!apiMethods.has(request.method) && new URL(request.url).pathname.startsWith('/api/')) {
        return new Response(null, { status: 400 });
    }
    return next();
});

export const startInstance = createStart(() => ({
    requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }), consoleRequests],
}));
