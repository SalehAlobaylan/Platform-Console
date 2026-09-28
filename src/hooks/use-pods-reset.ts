import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePodsResetPlan,
  cancelPodsResetPlan,
  createPodsResetPreview,
  executePodsResetRun,
  getPodsResetPlan,
  listPodsResetRuns,
  listPodsResetCandidates,
  requestPodsResetPause,
  resumePodsResetRun,
} from '@/lib/api/cms/pods-reset';
import type { PodsResetCandidateQuery } from '@/types/platform/pods-reset';
import { toast } from '@/components/ui/toast';

export const podsResetKeys = {
  all: ['pods-reset'] as const,
  runs: () => [...podsResetKeys.all, 'runs'] as const,
  candidates: (filters: PodsResetCandidateQuery) => [...podsResetKeys.all, 'candidates', filters] as const,
  plan: (id?: string) => [...podsResetKeys.all, 'plan', id] as const,
};

export function usePodsResetRuns() {
  return useQuery({
    queryKey: podsResetKeys.runs(),
    queryFn: listPodsResetRuns,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function usePodsResetCandidates(filters: PodsResetCandidateQuery, enabled: boolean) {
  return useQuery({
    queryKey: podsResetKeys.candidates(filters),
    queryFn: () => listPodsResetCandidates(filters),
    enabled,
    staleTime: 15_000,
  });
}

export function usePodsResetPlan(id?: string) {
  return useQuery({
    queryKey: podsResetKeys.plan(id),
    queryFn: () => getPodsResetPlan(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
}

function usePodsResetMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  success: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podsResetKeys.all });
      toast({ title: success, variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Pods reset action failed',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useCreatePodsResetPreview() {
  return usePodsResetMutation(
    ({
      contentIds,
      selectionReason,
    }: {
      contentIds: string[];
      selectionReason: string;
    }) => createPodsResetPreview(contentIds, selectionReason),
    'Read-only Pods reset preview prepared'
  );
}

export function useApprovePodsResetPlan() {
  return usePodsResetMutation(
    ({ id, phrase }: { id: string; phrase: string }) =>
      approvePodsResetPlan(id, phrase),
    'Pods reset approval recorded'
  );
}

export function useExecutePodsResetRun() {
  return usePodsResetMutation(
    executePodsResetRun,
    'Pods reset progress updated'
  );
}

export function useCancelPodsResetPlan() {
  return usePodsResetMutation(
    cancelPodsResetPlan,
    'Pods reset plan cancelled before execution'
  );
}

export function useRequestPodsResetPause() {
  return usePodsResetMutation(
    requestPodsResetPause,
    'Pods reset will pause at the next item boundary'
  );
}

export function useResumePodsResetRun() {
  return usePodsResetMutation(resumePodsResetRun, 'Pods reset resumed');
}
