import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { POST } from '@/app/api/auth/refresh/route';

export const Route = createFileRoute('/api/auth/refresh')({
    server: {
        handlers: {
            ...apiMethodFallbacks('POST'),
            POST: ({ request }) => POST(request),
        },
    },
});
