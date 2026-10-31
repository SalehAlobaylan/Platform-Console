'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import * as api from '@/lib/api/cms/operations';
export const opsKeys = { all: ['operations-command-center'] as const };
const key = (name: string, ...rest: unknown[]) => [
  ...opsKeys.all,
  name,
  ...rest,
];

export function useOpsClock() {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 10_000);
    return () => clearInterval(timer);
  }, []);
  // Query results can arrive between ticks. Compare their timestamps with the
  // current clock, otherwise a fresh preview can appear to be in the future.
  return Date.now();
}
function useOpsPolling(enabled = true) {
  const [visible, setVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return {
    enabled,
    staleTime: 15_000,
    refetchInterval: visible ? 30_000 : 120_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  } as const;
}
export function useOpsStatus(enabled = true) {
  return useQuery({
    queryKey: key('status'),
    queryFn: ({ signal }) => api.getOpsStatus(signal),
    ...useOpsPolling(enabled),
  });
}
export function useOpsAttention(filters?: api.OpsFilters, enabled = true) {
  return useQuery({
    queryKey: key('attention', filters ?? {}),
    queryFn: ({ signal }) => api.getOpsAttention(filters, signal),
    ...useOpsPolling(enabled),
  });
}
export function useOpsBriefing(enabled = true) {
  return useQuery({
    queryKey: key('briefing'),
    queryFn: ({ signal }) => api.getOpsBriefing(signal),
    ...useOpsPolling(enabled),
  });
}
export function useOpsCalendar(enabled = true) {
  return useQuery({
    queryKey: key('calendar'),
    queryFn: ({ signal }) => api.getOpsCalendar(signal),
    ...useOpsPolling(enabled),
  });
}
export function useOpsCommands(offset = 0, enabled = true) {
  return useQuery({
    queryKey: key('commands', offset),
    queryFn: ({ signal }) => api.listOpsCommands(offset, signal),
    ...useOpsPolling(enabled),
  });
}
export function useOpsCommand(id?: string) {
  return useQuery({
    queryKey: key('command', id),
    queryFn: ({ signal }) => api.getOpsCommand(id!, signal),
    enabled: !!id,
    staleTime: 15_000,
  });
}
export function useOpsRegistry(enabled: boolean) {
  return useQuery({
    queryKey: key('registry'),
    queryFn: ({ signal }) => api.getOpsFleet(signal),
    enabled,
    staleTime: 60_000,
  });
}
export function useOpsCommandPreview(scope: api.OpsCommandScope) {
  return useQuery({
    queryKey: key('preview', scope),
    queryFn: ({ signal }) => api.previewOpsCommand(scope, signal),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}
function useOpsMutation<T>(mutationFn: (value: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
    onError: (error: { message?: string }) =>
      toast({
        title: 'Action unavailable / تعذّر الإجراء',
        description: error.message,
        variant: 'destructive',
      }),
  });
}
export function useAckOpsAttention() {
  return useOpsMutation(api.ackOpsAttention);
}
export function useSnoozeOpsAttention() {
  return useOpsMutation(
    ({
      review,
      minutes,
    }: {
      review: api.OpsAttentionReview;
      minutes: number;
    }) => api.snoozeOpsAttention(review, minutes)
  );
}
export function useClearOpsAttention() {
  return useOpsMutation(api.clearOpsAttention);
}
export function useMarkOpsBriefingSeen() {
  return useOpsMutation(
    ({
      since,
      through,
      read_token,
    }: {
      since: string;
      through: string;
      read_token: string;
    }) => api.markOpsBriefingSeen(since, through, read_token)
  );
}
export function useExecuteOpsCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.executeOpsCommand,
    retry: false,
    onSuccess: (command) => {
      qc.invalidateQueries({ queryKey: opsKeys.all });
      const counts = Object.entries(command.counts ?? {})
        .map(([name, count]) => `${name}: ${count}`)
        .join(' · ');
      toast({
        title:
          command.status === 'failed'
            ? 'Command failed / فشل الأمر'
            : command.status === 'partial'
              ? 'Command partly applied / نُفّذ الأمر جزئياً'
              : 'Command completed / اكتمل الأمر',
        description: counts,
        variant:
          command.status === 'failed'
            ? 'destructive'
            : command.status === 'partial'
              ? 'default'
              : 'success',
      });
    },
    onError: (error: { message?: string }) =>
      toast({
        title: 'Command unavailable / تعذّر الأمر',
        description: error.message,
        variant: 'destructive',
      }),
  });
}
