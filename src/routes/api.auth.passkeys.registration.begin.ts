import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { beginPasskey } from '@/lib/server/console-passkeys';

export const Route = createFileRoute('/api/auth/passkeys/registration/begin')({
    server: { handlers: {
        ...apiMethodFallbacks('POST'),
        POST: ({ request }) => beginPasskey(request, 'registration'),
    } },
});
