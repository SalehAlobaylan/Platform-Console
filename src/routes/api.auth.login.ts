import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { POST } from '@/app/api/auth/login/route';

export const Route = createFileRoute('/api/auth/login')({
    server: {
        handlers: {
            ...apiMethodFallbacks('POST'),
            POST: ({ request }) => POST(request),
        },
    },
});
