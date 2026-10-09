import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePodsResetPlan,
  cancelPodsResetPlan,
  createPodsResetQuantityPreview,
  createPodsResetPreview,
  executePodsResetRun,
  getPodsResetPlan,
  listPodsResetRuns,
  listPodsResetCandidates,
  requestPodsResetPause,
  resumePodsResetRun,
} from '@/lib/api/cms/pods-reset';
import type { PodsResetCandidateQuery, PodsResetPlanDetail } from '@/types/platform/pods-reset';
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
      itemCount,
      filters,
      selectionReason,
    }: {
      itemCount: number;
      filters: PodsResetCandidateQuery;
      selectionReason: string;
    }) => createPodsResetQuantityPreview(itemCount, filters, selectionReason),
    'Read-only Pods reset preview prepared'
  );
}

export function useApprovePodsResetPlan() {
  return usePodsResetMutation(
    ({ id, phrase }: { id: string; phrase: string }) => approvePodsResetPlan(id, phrase),
    'Pods reset approval recorded'
  );
}

export function useCreatePodsResetProtectionPreview() {
  return usePodsResetMutation(
    ({ contentIds, selectionReason, codes, reason }: {
      contentIds: string[]; selectionReason: string; codes: string[]; reason: string;
    }) => createPodsResetPreview(contentIds, selectionReason, { codes, reason }),
    'New deletion preview prepared with the reviewed protection choices'
  );
}

export function useExecutePodsResetRun() {
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return useMutation({
    mutationFn: (input: Parameters<typeof executePodsResetRun>[0]) => {
      const task = new AbortController();
      controller.current = task;
      return executePodsResetRun(input, async (progress) => {
        // An older poll must not overwrite the batch's committed progress.
        await queryClient.cancelQueries({ queryKey: podsResetKeys.plan(input.id), exact: true });
        queryClient.setQueryData<PodsResetPlanDetail>(podsResetKeys.plan(input.id), (previous) => {
          if (!previous) return previous;
          const absent = new Set(progress.items?.filter((item) => ['verification_pending', 'objects_deleted', 'complete'].includes(item.state)).map((item) => item.content_item_id));
          return {
            ...previous,
            run: { ...previous.run, state: progress.state, phase: progress.phase ?? previous.run.phase, pause_requested: progress.phase === 'paused' || previous.run.pause_requested, error: progress.warning ?? progress.error ?? '' },
            items: progress.items ?? previous.items,
            objects: previous.objects.map((object) => absent.has(object.content_item_id ?? '') ? { ...object, state: 'deleted' } : object),
          };
        });
      }, task.signal);
    },
    onSuccess: (progress) => {
      queryClient.invalidateQueries({ queryKey: podsResetKeys.all });
      if (controller.current?.signal.aborted) return;
      const stoppedError = progress.warning || progress.error || progress.items?.find((item) => item.last_error && item.last_error !== 'verification_probe_not_due')?.last_error;
      toast({
        title: progress.state === 'complete' ? 'Pods deletion complete' : progress.phase === 'paused' ? 'Pods deletion paused' : 'Pods deletion stopped',
        description: stoppedError,
        variant: progress.state === 'complete' ? 'success' : stoppedError ? 'destructive' : 'default',
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: podsResetKeys.all });
      if (!controller.current?.signal.aborted) toast({ title: 'Pods deletion stopped', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelPodsResetPlan() {
  return usePodsResetMutation(cancelPodsResetPlan, 'Pods reset plan cancelled before execution');
}

export function useRequestPodsResetPause() {
  return usePodsResetMutation(requestPodsResetPause, 'Pods reset will pause at the next item boundary');
}

export function useResumePodsResetRun() {
  return usePodsResetMutation(resumePodsResetRun, 'Pods reset resumed');
}
