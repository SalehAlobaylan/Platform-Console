'use client';

import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { signInLocation } from '@/lib/sign-in-destination';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
    children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);

    const href = useLocation({ select: (location) => location.href });
    const pathname = useLocation({ select: (location) => location.pathname });
    const issue = useAuthStore((state) => state.sessionIssue);
    const checkAuth = useAuthStore((state) => state.checkAuth);

    useEffect(() => {
        if (!isLoading && !isAuthenticated && issue !== 'unavailable' && pathname !== '/login') {
            router.replace(signInLocation(href, issue === 'runtime_changed'), { fromPath: pathname });
        }
    }, [isLoading, isAuthenticated, issue, router, href, pathname]);

    if (!isAuthenticated && issue === 'unavailable') {
        return (
            <main className="flex min-h-screen items-center justify-center p-6">
                <div className="space-y-4 text-center">
                    <p role="alert">We couldn’t check your session. Try again to continue.</p>
                    <Button onClick={() => void checkAuth()} disabled={isLoading}>Retry</Button>
                </div>
            </main>
        );
    }

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render children if not authenticated (will redirect)
    if (!isAuthenticated) {
        return null;
    }

    return <>
        {issue === 'unavailable' && <div role="status" className="flex items-center justify-center gap-3 border-b p-2 text-sm">
            The sign-in service is temporarily unavailable.
            <Button variant="outline" size="sm" onClick={() => void checkAuth()}>Retry</Button>
        </div>}
        {children}
    </>;
}
