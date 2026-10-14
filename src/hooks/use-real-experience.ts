import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
  getExperienceEvidence,
  closeExperienceIncident,
  createExperienceSuppression,
  getExperienceMetrics,
  getExperienceStatus,
  listExperienceActions,
  listExperienceIncidents,
  listExperienceRuns,
  listExperienceSuppressions,
  pauseExperienceSchedule,
  revokeExperienceSuppression,
  runExperienceNow,
  updateExperiencePolicy,
} from '@/lib/api/cms/real-experience';
import type {
  ExperiencePolicy,
  ExperienceClient,
  IncidentCloseReason,
} from '@/types/platform/real-experience';

export const experienceKeys = {
  all: ['real-experience'] as const,
  status: () => [...experienceKeys.all, 'status'] as const,
  metrics: () => [...experienceKeys.all, 'metrics'] as const,
  runs: () => [...experienceKeys.all, 'runs'] as const,
  incidents: () => [...experienceKeys.all, 'incidents'] as const,
  actions: () => [...experienceKeys.all, 'actions'] as const,
  suppressions: () => [...experienceKeys.all, 'suppressions'] as const,
};

export function useExperienceStatus() {
  return useQuery({
    queryKey: experienceKeys.status(),
    queryFn: getExperienceStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useExperienceMetrics(client: ExperienceClient = 'web') {
  return useQuery({
    queryKey: [...experienceKeys.metrics(), client],
    queryFn: () => getExperienceMetrics(client),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useExperienceRuns() {
  return useQuery({
    queryKey: experienceKeys.runs(),
    queryFn: listExperienceRuns,
    staleTime: 15_000,
  });
}
export function useExperienceIncidents(client: ExperienceClient = 'web') {
  return useQuery({
    queryKey: [...experienceKeys.incidents(), client],
    queryFn: () => listExperienceIncidents(undefined, client),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useExperienceActions(client: ExperienceClient = 'web') {
  return useQuery({
    queryKey: [...experienceKeys.actions(), client],
    queryFn: () => listExperienceActions(client),
    staleTime: 15_000,
  });
}
export function useExperienceSuppressions(client: ExperienceClient = 'web') {
  return useQuery({
    queryKey: [...experienceKeys.suppressions(), client],
    queryFn: () => listExperienceSuppressions(client),
    staleTime: 15_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return () => qc.invalidateQueries({ queryKey: experienceKeys.all });
}

const controlError = (e: Error) =>
  toast({
    title: 'Real Experience control failed',
    description: e.message,
    variant: 'destructive',
  });

export function useUpdateExperiencePolicy() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: (patch: Partial<ExperiencePolicy>) =>
      updateExperiencePolicy(patch),
    onSuccess: async () => {
      await invalidate(qc)();
      toast({ title: 'Real Experience settings saved', variant: 'success' });
    },
  });
}
export function useRunExperienceNow() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: runExperienceNow,
    onSuccess: (run) => {
      invalidate(qc)();
      toast({
        title:
          run.status === 'failed'
            ? 'Evaluation failed'
            : run.status === 'partial'
              ? 'Evaluation incomplete'
              : 'Evaluation complete',
        description: run.summary,
        variant:
          run.status === 'failed'
            ? 'destructive'
            : run.status === 'partial'
              ? 'default'
              : 'success',
      });
    },
  });
}
export function usePauseExperienceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: pauseExperienceSchedule,
    onSuccess: () => invalidate(qc)(),
  });
}
export function useCloseExperienceIncident() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: ({
      id,
      reason_class,
      notes,
    }: {
      id: string;
      reason_class: IncidentCloseReason;
      notes?: string;
    }) => closeExperienceIncident(id, reason_class, notes),
    onSuccess: async () => {
      await invalidate(qc)();
      toast({ title: 'Incident closed', variant: 'success' });
    },
  });
}
export function useCreateExperienceSuppression() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: createExperienceSuppression,
    onSuccess: async () => {
      await invalidate(qc)();
      toast({ title: 'Suppression created', variant: 'success' });
    },
  });
}
export function useRevokeExperienceSuppression() {
  const qc = useQueryClient();
  return useMutation({
    onError: controlError,
    mutationFn: revokeExperienceSuppression,
    onSuccess: () => invalidate(qc)(),
  });
}

export function useExperienceEvidence<T>(
  kind: string | null,
  id?: string,
  query?: Record<string, string>
) {
  return useQuery({
    queryKey: [...experienceKeys.all, 'evidence', kind, id, query],
    queryFn: () => getExperienceEvidence<T>(kind!, id, query),
    enabled: Boolean(kind),
    staleTime: 15000,
  });
}
