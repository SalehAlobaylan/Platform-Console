import { readCookie } from '@/lib/server/session-cookies';

export async function GET(request: Request): Promise<Response> {
  const session = readCookie(request, 'console_access_token');
  if (!session) return Response.json({ message: 'Not authenticated' }, { status: 401 });
  const base = process.env.MIGRATION_COORDINATOR_URL?.replace(/\/$/, '');
  const token = process.env.MIGRATION_COORDINATOR_READ_TOKEN?.trim();
  if (!base || !token) return Response.json({ message: 'Migration coordinator is not configured' }, { status: 503 });
  const segment = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  if (!segment || !['actions', 'status', 'programs'].includes(segment)) return Response.json({ message: 'Unsupported migration coordinator read' }, { status: 404 });
  try {
    const response = await fetch(`${base}/admin/database-migrations/${segment}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const body = await response.text();
    return new Response(body, { status: response.status, headers: { 'content-type': 'application/json' } });
  } catch { return Response.json({ message: 'Migration coordinator unavailable' }, { status: 502 }); }
}
