import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { POST } from '@/app/api/system-health/migrations/route';

export const Route = createFileRoute('/api/system-health/migrations')({
    server: {
        handlers: {
            ...apiMethodFallbacks('POST'),
            POST: ({ request }) => POST(request),
        },
    },
});
