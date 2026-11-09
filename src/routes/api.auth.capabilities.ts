import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { consoleCapabilities } from '@/lib/server/console-recovery';

export const Route = createFileRoute('/api/auth/capabilities')({
    server: { handlers: {
        ...apiMethodFallbacks('GET'),
        GET: ({ request }) => consoleCapabilities(request),
    } },
});
