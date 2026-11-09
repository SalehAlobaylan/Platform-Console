import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { GET } from '@/app/api/database-migrations/programs/route';

export const Route = createFileRoute('/api/database-migrations/programs')({
    server: {
        handlers: {
            ...apiMethodFallbacks('GET'),
            GET: ({ request }) => GET(request),
        },
    },
});
