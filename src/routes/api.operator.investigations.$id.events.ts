import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET } from '@/app/api/operator/investigations/[id]/events/route';

export const Route = createFileRoute('/api/operator/investigations/$id/events')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET'),
            GET: ({ request, params }) => GET(request, { params: Promise.resolve(params) }),
        },
    },
});
