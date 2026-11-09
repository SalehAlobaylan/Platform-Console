import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { listPasskeys } from '@/lib/server/console-passkeys';

export const Route = createFileRoute('/api/auth/passkeys')({
    server: { handlers: {
        ...apiMethodFallbacks('GET'),
        GET: ({ request }) => listPasskeys(request),
    } },
});
