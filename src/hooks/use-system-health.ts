import { useQuery } from '@tanstack/react-query';
import type { SystemHealthSnapshot } from '@/types/platform/system-health';

async function fetchSystemHealth({ signal }: { signal: AbortSignal }): Promise<SystemHealthSnapshot> {
    const resp = await fetch('/api/system-health', { cache: 'no-store', signal });
    if (!resp.ok) {
        throw new Error(`Failed to load system health (HTTP ${resp.status})`);
    }
    return (await resp.json()) as SystemHealthSnapshot;
}

export const systemHealthKeys = {
    all: ['system-health'] as const,
};

export function useSystemHealth() {
    return useQuery({
        queryKey: systemHealthKeys.all,
        queryFn: fetchSystemHealth,
        refetchInterval: 15_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        staleTime: 10_000,
        retry: 1,
    });
}
