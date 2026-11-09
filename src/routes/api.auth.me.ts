import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET } from '@/app/api/auth/me/route';

export const Route = createFileRoute('/api/auth/me')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET'),
            GET: ({ request }) => GET(request),
        },
    },
});
