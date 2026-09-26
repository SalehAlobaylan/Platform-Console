import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
  closeSystemIncidentEpisode,
  getSystemIncidentEpisode,
  getSystemAutopilotRun,
  getSystemAutopilotStatus,
  listSystemAutopilotRuns,
  listSystemIncidentEpisodes,
  pauseSystemAutopilotContainment,
  runSystemAutopilotNow,
  updateSystemAutopilotPolicy,
} from '@/lib/api/cms/system-autopilot';
import type { SystemAutopilotPolicy } from '@/types/platform/system-autopilot';
import { systemHealthKeys } from '@/hooks/use-system-health';

export const systemAutopilotKeys = {
  all: ['system-autopilot'] as const,
  status: () => [...systemAutopilotKeys.all, 'status'] as const,
  runs: (limit: number) => [...systemAutopilotKeys.all, 'runs', limit] as const,
  run: (id: string) => [...systemAutopilotKeys.all, 'run', id] as const,
  episodes: (limit: number) =>
    [...systemAutopilotKeys.all, 'episodes', limit] as const,
  episode: (id: string) => [...systemAutopilotKeys.all, 'episode', id] as const,
};

export function useSystemAutopilotStatus() {
  return useQuery({
    queryKey: systemAutopilotKeys.status(),
    queryFn: getSystemAutopilotStatus,
    staleTime: 15_000,
    gcTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useSystemAutopilotRuns(limit = 20, enabled = true) {
  return useQuery({
    queryKey: systemAutopilotKeys.runs(limit),
    enabled,
    queryFn: () => listSystemAutopilotRuns(limit),
    staleTime: 10_000,
  });
}

export function useSystemAutopilotRun(id: string | null) {
  return useQuery({
    queryKey: systemAutopilotKeys.run(id ?? 'none'),
    queryFn: () => getSystemAutopilotRun(id as string),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useSystemIncidentEpisodes(limit = 50, enabled = true) {
  return useQuery({
    queryKey: systemAutopilotKeys.episodes(limit),
    enabled,
    queryFn: () => listSystemIncidentEpisodes(limit),
    staleTime: 10_000,
  });
}

export function useSystemIncidentEpisode(id: string | null) {
  return useQuery({
    queryKey: systemAutopilotKeys.episode(id ?? 'none'),
    queryFn: () => getSystemIncidentEpisode(id as string),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useUpdateSystemAutopilotPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SystemAutopilotPolicy>) =>
      updateSystemAutopilotPolicy(patch),
	onSuccess: () => {
		qc.invalidateQueries({ queryKey: systemAutopilotKeys.all });
		qc.invalidateQueries({ queryKey: systemHealthKeys.all });
      toast({ title: 'System Health Autopilot saved', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Failed to save System Health Autopilot',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useRunSystemAutopilotNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runSystemAutopilotNow,
    onSuccess: (detail) => {
      qc.invalidateQueries({ queryKey: systemAutopilotKeys.all });
      qc.invalidateQueries({ queryKey: systemHealthKeys.all });
      toast({
        title: 'System Health diagnostic probe complete',
        description: detail.run.summary || detail.run.status,
        variant: detail.run.status === 'failed' ? 'destructive' : 'success',
      });
    },
    onError: (error: Error) =>
      toast({
        title: 'System Health Autopilot run failed',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function usePauseSystemAutopilotContainment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (minutes: number) => pauseSystemAutopilotContainment(minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: systemAutopilotKeys.status() });
      toast({ title: 'Containment pause updated', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Failed to update containment pause',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useCloseSystemIncidentEpisode() {
  const qc = useQueryClient();
  return useMutation({
	mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      closeSystemIncidentEpisode(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: systemAutopilotKeys.all });
      toast({ title: 'Incident episode closed', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Failed to close incident',
        description: error.message,
        variant: 'destructive',
      }),
  });
}
