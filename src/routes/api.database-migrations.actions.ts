import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET } from '@/app/api/database-migrations/actions/route';

export const Route = createFileRoute('/api/database-migrations/actions')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET'),
            GET: ({ request }) => GET(request),
        },
    },
});
