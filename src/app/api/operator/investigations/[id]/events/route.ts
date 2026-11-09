import { readCookie } from '@/lib/server/session-cookies';

import { operatorEventResponseSchema } from '@/lib/operator/schemas';

const ACCESS_COOKIE = 'console_access_token';
const INVESTIGATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCursor(request: Request): number | null {
  const raw = request.headers.get('last-event-id') || new URL(request.url).searchParams.get('after') || '0';
  if (!/^(0|[1-9]\d*)$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// This is intentionally not the generic CMS proxy. Its fixed upstream path
// makes it impossible for a browser to supply an arbitrary event target.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const cmsBaseUrl = process.env.CMS_BASE_URL?.replace(/\/$/, '');
  if (!cmsBaseUrl) return Response.json({ message: 'CMS_BASE_URL is not configured' }, { status: 500 });
  const { id } = await context.params;
  if (!INVESTIGATION_ID.test(id)) return Response.json({ message: 'Invalid Operator investigation' }, { status: 400 });
  const cursor = parseCursor(request);
  if (cursor === null) return Response.json({ message: 'Invalid Operator event cursor' }, { status: 400 });
  const token = readCookie(request, ACCESS_COOKIE);
  if (!token) return Response.json({ message: 'Authentication required' }, { status: 401 });

  try {
    const upstream = await fetch(
      `${cmsBaseUrl}/admin/operator/investigations/${id}/events?after=${cursor}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(request.headers.get('x-request-id') ? { 'X-Request-ID': request.headers.get('x-request-id')! } : {}),
        },
        cache: 'no-store',
      }
    );
    const responseHeaders = new Headers();
    responseHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');
    responseHeaders.set('cache-control', 'no-store');
    if (upstream.ok) {
      const payload = operatorEventResponseSchema.safeParse(await upstream.json());
      if (!payload.success) return Response.json({ message: 'CMS returned an invalid Operator event payload' }, { status: 502, headers: responseHeaders });
      return Response.json(payload.data, { status: upstream.status, headers: responseHeaders });
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: 'Operator event stream is unavailable' }, { status: 502 });
  }
}
