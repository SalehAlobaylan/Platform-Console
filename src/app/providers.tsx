'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toast';
import { AuthProvider } from '@/components/auth';

interface ProvidersProps {
  children: React.ReactNode;
}

// React Query cache configuration for optimal performance
const CACHE_CONFIG = {
  // List queries: Cache for 2 minutes, stale after 30 seconds
  lists: {
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  },
  // Detail queries: Cache for 5 minutes, stale after 1 minute
  details: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  },
  // Reference data (tags, statuses): Cache for 10 minutes
  reference: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },
};

export { CACHE_CONFIG };

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: CACHE_CONFIG.lists.staleTime,
            gcTime: CACHE_CONFIG.lists.gcTime,
            refetchOnWindowFocus: false,
            retry: 1,
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
