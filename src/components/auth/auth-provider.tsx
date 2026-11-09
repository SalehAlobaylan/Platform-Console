'use client';

import { consoleRuntime } from '@/lib/runtime-config';
import '@/lib/runtime-fetch';

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useAuthStore, clearAuthState } from '@/lib/stores/auth';
import { onSessionChange } from '@/lib/auth-session';
import { setErrorHandlers } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';

interface AuthProviderProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function AuthProvider({ children, queryClient }: AuthProviderProps) {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    const sync = (state: ReturnType<typeof useAuthStore.getState>) => {
      if (state.isLoading) return;
      const owner =
        state.isAuthenticated && state.user
          ? `${consoleRuntime().runtimeId || 'console'}:${state.user.tenant_id || ''}:${state.user.id}`
          : undefined;
      const previous = useWorkspaceSession.getState().owner;
      if (previous && owner !== previous) queryClient?.clear();
      useWorkspaceSession.getState().setOwner(owner);
    };
    sync(useAuthStore.getState());
    return useAuthStore.subscribe(sync);
  }, [queryClient]);

  useEffect(() => {
    // Check authentication status on mount
    checkAuth();

    // Set up API error handlers
    setErrorHandlers({
      on401: (error) => {
        clearAuthState();
        if (error.code === 'runtime_changed') useAuthStore.setState({ sessionIssue: 'runtime_changed' });
      },
      onSessionUnavailable: () => useAuthStore.setState({ sessionIssue: 'unavailable' }),
      on403: (error) => {
        // Show permission denied toast
        toast({
          title: 'Permission Denied',
          description:
            error.message ||
            'You do not have permission to perform this action.',
          variant: 'destructive',
        });
      },
    });
    return onSessionChange((kind) => {
      clearAuthState();
      if (kind === 'login') {
        useAuthStore.setState({ isLoading: true });
        void checkAuth();
      }
    });
  }, [checkAuth]);

  return <>{children}</>;
}
