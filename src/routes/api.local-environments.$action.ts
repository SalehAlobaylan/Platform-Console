import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET, POST } from '@/app/api/local-environments/[action]/route';

export const Route = createFileRoute('/api/local-environments/$action')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET', 'POST'),
            GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }),
            POST: ({ request, params }) => POST(request, { params: Promise.resolve(params) }),
        },
    },
});
