import { NextRequest, NextResponse } from 'next/server';

// Every managed restart requires a new login, including restart in the same
// environment. Cookies minted for a cloned database cannot cross this boundary.
export function middleware(request: NextRequest) {
  const runtime = process.env.WAHB_RUNTIME_ID;
  const path = request.nextUrl.pathname;
  if (!runtime || !path.startsWith('/api/')) return NextResponse.next();
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const publicAuth = path === '/api/auth/login' || path === '/api/auth/logout';
  if (mutation && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json(
      { message: 'Same-origin requests are required' },
      { status: 403 }
    );
  }
  if (
    (mutation || request.headers.has('x-wahb-runtime-id')) &&
    request.headers.get('x-wahb-runtime-id') !== runtime
  ) {
    return NextResponse.json(
      {
        message: 'The app restarted. Refresh this tab before continuing.',
        code: 'runtime_changed',
      },
      { status: 409 }
    );
  }
  if (
    !publicAuth &&
    request.cookies.get('console_runtime_id')?.value !== runtime
  ) {
    return NextResponse.json(
      { message: 'The app restarted. Sign in again.', code: 'runtime_changed' },
      { status: 401 }
    );
  }
  return NextResponse.next();
}
export const config = { matcher: ['/api/:path*'] };
