import { createFileRoute } from '@tanstack/react-router';
import { apiMethodFallbacks } from '@/lib/server/api-methods';
import { forgotPassword } from '@/lib/server/console-recovery';

export const Route = createFileRoute('/api/auth/forgot-password')({
    server: { handlers: {
        ...apiMethodFallbacks('POST'),
        POST: ({ request }) => forgotPassword(request),
    } },
});
