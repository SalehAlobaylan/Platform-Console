import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const IAM_URL = process.env.IAM_BASE_URL;

export async function POST() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('console_access_token')?.value;

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

    cookieStore.delete('console_access_token');
    cookieStore.delete('console_refresh_token');
    cookieStore.delete('console_token_expires');
    cookieStore.delete('console_runtime_id');

    return NextResponse.json({ success: true });
}
