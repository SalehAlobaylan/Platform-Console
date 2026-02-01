import { useQuery } from '@tanstack/react-query';
import {
    getReportsOverview,
} from '@/lib/api/crm/reports';
import type {
    ReportsOverviewResponse,
} from '@/types/crm';

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
        // Refetch every 5 minutes to keep metrics fresh
        refetchInterval: 5 * 60 * 1000,
    });
}
