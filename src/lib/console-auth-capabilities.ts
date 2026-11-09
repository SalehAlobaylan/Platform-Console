import { useQuery } from '@tanstack/react-query';
import { authRequest } from './api/iam/auth';

export function useConsoleAuthCapabilities() {
    return useQuery({
        queryKey: ['console-auth-capabilities'],
        queryFn: async () => {
            const response = await authRequest('/api/auth/capabilities', { timeout: 5_000 });
            if (!response.ok) return { recovery: false, passkeys: false };
            return response.json() as Promise<{ recovery: boolean; passkeys: boolean }>;
        },
        staleTime: 60_000,
        retry: false,
    }).data;
}
