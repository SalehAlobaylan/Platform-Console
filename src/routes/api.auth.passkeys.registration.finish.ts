import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { finishPasskey } from '@/lib/server/console-passkeys';

export const Route = createFileRoute('/api/auth/passkeys/registration/finish')({
    server: { handlers: {
        ...apiMethodFallbacks('POST'),
        POST: ({ request }) => finishPasskey(request, 'registration'),
    } },
});
