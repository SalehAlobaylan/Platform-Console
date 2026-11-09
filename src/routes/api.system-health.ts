import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET } from '@/app/api/system-health/route';

export const Route = createFileRoute('/api/system-health')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET'),
            GET: ({ request }) => GET(request),
        },
    },
});
