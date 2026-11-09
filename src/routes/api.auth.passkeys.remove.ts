import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { removePasskey } from '@/lib/server/console-passkeys';

export const Route = createFileRoute('/api/auth/passkeys/remove')({
    server: { handlers: {
        ...apiMethodFallbacks('POST'),
        POST: ({ request }) => removePasskey(request),
    } },
});
