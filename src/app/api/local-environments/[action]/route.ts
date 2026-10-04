import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  overviewSchema,
  planSchema,
  reportSchema,
  upgradeJobSchema,
} from '@/lib/api/local-environments';
import {
  currentRuntimeID,
  hasCurrentRuntimeSession,
  sameOrigin,
} from '@/lib/server/runtime-session';

export const dynamic = 'force-dynamic';
const environment = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const schemas = {
  selection: z
    .object({ environment, revision: z.number().int().nonnegative() })
    .strict(),
  inspect: z.object({ environment }).strict(),
  plan: z.object({ environment }).strict(),
  'upgrade-plan': z.object({ environment }).strict(),
  upgrade: z
    .object({
      plan_id: z.string().uuid(),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  review: z
    .object({
      plan_id: z.string().uuid(),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
};
const responseSchemas = {
  overview: overviewSchema,
  inspect: reportSchema,
  plan: planSchema,
  'upgrade-plan': planSchema,
  upgrade: upgradeJobSchema,
  'upgrade-job': upgradeJobSchema,
};
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
  const reading = request.method === 'GET';
  if (
    !(reading
      ? ['overview', 'history', 'upgrade-job'].includes(action)
      : Object.hasOwn(schemas, action))
  )
    return NextResponse.json(
      { message: 'Unsupported environment action' },
      { status: 404 }
    );
  const store = await cookies();
  const access = store.get('console_access_token')?.value;
  if (!access || !hasCurrentRuntimeSession(store))
    return NextResponse.json(
      { message: 'Sign in again for this runtime' },
      { status: 401 }
    );
  const runtime = currentRuntimeID();
  if (!runtime)
    return NextResponse.json(
      {
        message:
          'Local environments are available only in a managed start.sh runtime',
      },
      { status: 503 }
    );
  if (
    !reading &&
    (!sameOrigin(request) ||
      request.headers.get('x-wahb-runtime-id') !== runtime)
  )
    return NextResponse.json(
      { message: 'Refresh this tab before continuing' },
      { status: 409 }
    );
  const base = process.env.MIGRATION_COORDINATOR_URL;
  const token = process.env.MIGRATION_COORDINATOR_READ_TOKEN;
  if (!base || !token)
    return NextResponse.json(
      {
        message:
          'Coordinator is unavailable. Use scripts/env.sh while the stack is stopped.',
      },
      { status: 503 }
    );
  let body: string | undefined;
  let query = '';
  if (reading && action === 'history') {
    const id = environment.safeParse(
      request.nextUrl.searchParams.get('environment')
    );
    if (!id.success)
      return NextResponse.json(
        { message: 'Registered environment ID required' },
        { status: 400 }
      );
    query = `?environment=${encodeURIComponent(id.data)}`;
  }
  if (reading && action === 'upgrade-job') {
    const id = z
      .string()
      .uuid()
      .safeParse(request.nextUrl.searchParams.get('id'));
    if (!id.success)
      return NextResponse.json(
        { message: 'Upgrade job ID required' },
        { status: 400 }
      );
    query = `?id=${encodeURIComponent(id.data)}`;
  }
  if (!reading) {
    const parsed = schemas[action as keyof typeof schemas].safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success)
      return NextResponse.json(
        { message: 'Invalid request fields' },
        { status: 400 }
      );
    body = JSON.stringify(parsed.data);
  }
  try {
    const response = await fetch(
      `${base.replace(/\/$/, '')}/admin/local-environments/${action}${query}`,
      {
        method: reading ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Wahb-Runtime-ID': runtime,
          'X-Wahb-Actor-Token': access,
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(reading ? 10_000 : 180_000),
      }
    );
    const responseSchema =
      responseSchemas[action as keyof typeof responseSchemas];
    if (response.ok && responseSchema) {
      // Serve a canonical view of old saved reports, including empty issue
      // arrays. Keep their evidence IDs/digests and retained files unchanged.
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success)
        return NextResponse.json(
          {
            message:
              'The coordinator returned invalid environment evidence. Use scripts/env.sh doctor for details.',
          },
          { status: 502, headers: { 'cache-control': 'no-store' } }
        );
      return NextResponse.json(parsed.data, {
        status: response.status,
        headers: { 'cache-control': 'no-store' },
      });
    }
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        message:
          'Coordinator check did not complete. Use the offline command if the stack cannot run.',
      },
      { status: 502 }
    );
  }
}
export const GET = proxy;
export const POST = proxy;
