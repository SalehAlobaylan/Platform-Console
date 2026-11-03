import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getPodsAutomation,
  setPodsAutomation,
  getPodsPipelineActivity,
} from '@/lib/api/cms/pods-automation';
import { toast } from '@/components/ui/toast';

export const podsAutomationKey = ['pods-automation'] as const;

export function usePodsAutomation() {
  return useQuery({
    queryKey: podsAutomationKey,
    queryFn: getPodsAutomation,
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function usePodsPipelineActivity(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...podsAutomationKey, 'activity'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getPodsPipelineActivity(pageParam, signal),
    getNextPageParam: (page) => page.next_cursor || undefined,
    enabled,
    staleTime: 15_000,
  });
}

export function useSetPodsAutomation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paused,
      version,
    }: {
      paused: boolean;
      version: string;
    }) => {
      try {
        return await setPodsAutomation(paused, version);
      } catch (error) {
        // A lost acknowledgement is resolved by reading the owner, not
        // by resubmitting a resume against a different control version.
        const status =
          error && typeof error === 'object' && 'status' in error
            ? Number(error.status)
            : 0;
        if (status > 0 && status < 500) throw error;
        const current = await getPodsAutomation().catch(() => null);
        if (current?.paused === paused) return current;
        throw error;
      }
    },
    onSuccess: (status) => {
      client.setQueryData(podsAutomationKey, status);
      void Promise.allSettled([
        ...[
          'pipeline',
          'media-journey',
          'sources',
          'discovery',
          'content',
          'media-atomization',
          'operations-command-center',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
        client.invalidateQueries({
          queryKey: [...podsAutomationKey, 'activity'],
        }),
      ]);
      toast({
        title: status.paused ? 'Pods pipeline paused' : 'Pods pipeline resumed',
        variant: 'success',
      });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: podsAutomationKey });
    },
  });
}
