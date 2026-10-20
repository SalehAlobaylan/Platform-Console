'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/cms/workload';
import type {
  WorkloadFilters,
  WorkloadPolicyUpdate,
} from '@/types/platform/workload';

export const workloadKeys = { all: ['workload-governor'] as const };

/** Hidden pages release polling and react-query aborts unobserved requests. */
export function useWorkloadVisible() {
  const [visible, setVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}
function usePolling(enabled: boolean) {
  const visible = useWorkloadVisible();
  return {
    enabled: enabled && visible,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: 1,
  };
}
export function useWorkloadStatus(enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'status'],
    queryFn: ({ signal }) => api.getWorkloadStatus(signal),
    ...usePolling(enabled),
  });
}
export function useWorkloadRegistry(enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'registry'],
    queryFn: ({ signal }) => api.getWorkloadRegistry(signal),
    ...usePolling(enabled),
    staleTime: 60_000,
    refetchInterval: false,
  });
}
export function useWorkloadQualification(enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'qualification'],
    queryFn: ({ signal }) => api.getWorkloadQualification(signal),
    ...usePolling(enabled),
  });
}
export function useWorkloadPermits(filters: WorkloadFilters, enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'permits', filters],
    queryFn: ({ signal }) => api.listWorkloadPermits(filters, signal),
    ...usePolling(enabled),
  });
}
export function useWorkloadDecisions(filters: WorkloadFilters, enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'decisions', filters],
    queryFn: ({ signal }) => api.listWorkloadDecisions(filters, signal),
    ...usePolling(enabled),
  });
}
export function useWorkloadSnapshots(filters: WorkloadFilters, enabled = true) {
  return useQuery({
    queryKey: [...workloadKeys.all, 'snapshots', filters],
    queryFn: ({ signal }) => api.listWorkloadSnapshots(filters, signal),
    ...usePolling(enabled),
  });
}
function useInvalidateWorkload() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: workloadKeys.all });
}
export function useUpdateWorkloadPolicy() {
  return useMutation({
    mutationFn: (input: WorkloadPolicyUpdate) =>
      api.updateWorkloadPolicy(input),
    onSuccess: useInvalidateWorkload(),
  });
}
export function usePauseWorkload() {
  return useMutation({
    mutationFn: api.pauseWorkload,
    onSuccess: useInvalidateWorkload(),
  });
}
export function useRevokeWorkloadPermit() {
  return useMutation({
    mutationFn: api.revokeWorkloadPermit,
    onSuccess: useInvalidateWorkload(),
  });
}
