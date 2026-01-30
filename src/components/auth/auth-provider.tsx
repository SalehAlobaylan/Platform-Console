'use client';

import { useEffect } from 'react';
import { useAuthStore, clearAuthState } from '@/lib/stores/auth';
import { setErrorHandlers } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const checkAuth = useAuthStore((state) => state.checkAuth);

    useEffect(() => {
        // Check authentication status on mount
        checkAuth();

        // Set up API error handlers
        setErrorHandlers({
            on401: () => {
                // Clear auth state without redirect (redirect handled by AuthGuard)
                clearAuthState();
                // Redirect to login
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            },
            on403: (error) => {
                // Show permission denied toast
                toast({
                    title: 'Permission Denied',
                    description: error.message || 'You do not have permission to perform this action.',
                    variant: 'destructive',
                });
            },
        });
    }, [checkAuth]);

    return <>{children}</>;
}
