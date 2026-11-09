import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { resetPassword } from '@/lib/server/console-recovery';

export const Route = createFileRoute('/api/auth/reset-password')({
    server: { handlers: {
        ...apiMethodFallbacks('POST'),
        POST: ({ request }) => resetPassword(request),
    } },
});
