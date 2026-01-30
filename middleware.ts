import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login'];

// Routes that require authentication
const protectedRoutes = [
    '/',
    '/platform',
    '/crm',
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the route is public
    const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Check if the route is protected
    const isProtectedRoute = protectedRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (isProtectedRoute) {
        // TODO: For a more robust implementation, consider using cookies for token storage
        // instead of localStorage to enable server-side auth checks.
        // 
        // Current implementation relies on client-side AuthGuard for protection
        // because localStorage is not accessible in middleware.
        //
        // For now, we'll let the request through and rely on the client-side
        // AuthGuard to handle the redirect if the user is not authenticated.
        //
        // To enable cookie-based auth:
        // 1. Store token in httpOnly cookie on login
        // 2. Check for cookie here: request.cookies.get('auth-token')
        // 3. Redirect to /login if cookie is missing or invalid

        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
    ],
};
