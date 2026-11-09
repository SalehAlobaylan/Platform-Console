import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { POST } from '@/app/api/auth/logout/route';

export const Route = createFileRoute('/api/auth/logout')({
    server: {
        handlers: {
            ...apiMethodFallbacks('POST'),
            POST: ({ request }) => POST(request),
        },
    },
});
