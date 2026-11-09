import { readCookie, clearSessionHeaders } from '@/lib/server/session-cookies';

export async function POST(request: Request) {
    const IAM_URL = process.env.IAM_BASE_URL;
    const accessToken = readCookie(request, 'console_access_token');

    if (IAM_URL && accessToken) {
        try {
            await fetch(`${IAM_URL.replace(/\/$/, '')}/api/v1/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
        } catch {
            // best-effort; cookies are cleared regardless
        }
    }

    return Response.json({ success: true }, { headers: clearSessionHeaders(true) });
}
