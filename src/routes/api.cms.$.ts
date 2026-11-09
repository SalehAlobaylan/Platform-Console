import { createFileRoute } from '@tanstack/react-router';
import { GET, POST, PUT, PATCH, DELETE, OPTIONS } from '@/app/api/cms/[...path]/route';
import { proxySegments } from '@/lib/server/proxy';

export const Route = createFileRoute('/api/cms/$')({
    server: {
        handlers: {
            GET: ({ request }) => GET(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
            POST: ({ request }) => POST(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
            PUT: ({ request }) => PUT(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
            PATCH: ({ request }) => PATCH(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
            DELETE: ({ request }) => DELETE(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
            OPTIONS: ({ request }) => OPTIONS(request, { params: Promise.resolve({ path: proxySegments(request) }) }),
        },
    },
});
