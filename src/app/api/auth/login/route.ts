import { authError, finishSignIn, requestIam } from '@/lib/server/console-auth';
import { localQuickSignInCredentials } from '@/lib/server/local-quick-sign-in';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
        return authError(400, 'invalid_request', 'Enter your email and password.');
    }

    const credentials = body.mode === 'local-quick-sign-in'
        ? localQuickSignInCredentials(request)
        : { email: body.email, password: body.password };
    if (!credentials) {
        return authError(404, 'quick_sign_in_unavailable', 'Quick sign-in is unavailable.');
    }
    if (typeof credentials.email !== 'string' || !credentials.email.trim() ||
        typeof credentials.password !== 'string' || !credentials.password) {
        return authError(400, 'invalid_credentials', 'Enter your email and password.');
    }

    return finishSignIn(await requestIam('/auth/login', { body: credentials }));
}
