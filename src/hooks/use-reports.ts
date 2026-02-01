import { useQuery } from '@tanstack/react-query';
import { getReportsOverview } from '@/lib/api/crm/reports';
import type { ReportsOverviewResponse } from '@/types/crm';
import { CACHE_CONFIG } from '@/app/providers';

// Query keys
export const reportKeys = {
  all: ['reports'] as const,
  overview: () => [...reportKeys.all, 'overview'] as const,
};

/**
 * Hook to fetch reports overview
 */
export function useReportsOverview() {
  return useQuery({
    queryKey: reportKeys.overview(),
    queryFn: () => getReportsOverview(),
    // Shorter cache time since reports data changes frequently
    staleTime: CACHE_CONFIG.lists.staleTime,
    gcTime: CACHE_CONFIG.lists.gcTime,
    // Refetch every 5 minutes to keep metrics fresh
    refetchInterval: 5 * 60 * 1000,
  });
}
