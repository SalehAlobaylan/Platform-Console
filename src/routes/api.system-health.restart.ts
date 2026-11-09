import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { POST } from '@/app/api/system-health/restart/route';

export const Route = createFileRoute('/api/system-health/restart')({
    server: {
        handlers: {
            ...apiMethodFallbacks('POST'),
            POST: ({ request }) => POST(request),
        },
    },
});
