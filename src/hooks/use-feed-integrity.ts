import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
  closeFeedIntegrityEpisode,
  createFeedIntegritySuppression,
  reviewFeedIntegrityUnknownAction,
  getFeedIntegrityStatus,
  getFeedIntegrityRun,
  listFeedIntegrityEpisodes,
  listFeedIntegrityFindings,
  listFeedIntegrityRuns,
  pauseFeedIntegritySchedule,
  revokeFeedIntegritySuppression,
  runFeedIntegrity,
  updateFeedIntegrityPolicy,
  approveFeedIntegrityAutopilotAction,
  getFeedIntegrityAutopilotStatus,
  listFeedIntegrityAutopilotActions,
  pauseFeedIntegrityAutopilot,
  rejectFeedIntegrityAutopilotAction,
  runFeedIntegrityAutopilot,
  updateFeedIntegrityAutopilotPolicy,
} from '@/lib/api/cms/feed-integrity';
import type {
  FeedIntegrityPolicy,
  FeedIntegrityTier,
} from '@/types/platform/feed-integrity';

export const feedIntegrityKeys = {
  all: ['feed-integrity'] as const,
  status: () => [...feedIntegrityKeys.all, 'status'] as const,
  runs: () => [...feedIntegrityKeys.all, 'runs'] as const,
  findings: () => [...feedIntegrityKeys.all, 'findings'] as const,
  episodes: () => [...feedIntegrityKeys.all, 'episodes'] as const,
  autopilot: () => [...feedIntegrityKeys.all, 'autopilot'] as const,
  actions: () => [...feedIntegrityKeys.all, 'actions'] as const,
};

export function useFeedIntegrityStatus() {
  return useQuery({
    queryKey: feedIntegrityKeys.status(),
    queryFn: getFeedIntegrityStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityRuns() {
  return useQuery({
    queryKey: feedIntegrityKeys.runs(),
    queryFn: listFeedIntegrityRuns,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityRun(id: string) {
  return useQuery({
    queryKey: [...feedIntegrityKeys.runs(), id],
    queryFn: () => getFeedIntegrityRun(id),
    enabled: !!id,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityFindings() {
  return useQuery({
    queryKey: feedIntegrityKeys.findings(),
    queryFn: listFeedIntegrityFindings,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityEpisodes() {
  return useQuery({
    queryKey: feedIntegrityKeys.episodes(),
    queryFn: listFeedIntegrityEpisodes,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityAutopilotStatus() {
  return useQuery({
    queryKey: feedIntegrityKeys.autopilot(),
    queryFn: getFeedIntegrityAutopilotStatus,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
export function useFeedIntegrityAutopilotActions(enabled = true) {
  return useQuery({
    queryKey: feedIntegrityKeys.actions(),
    queryFn: listFeedIntegrityAutopilotActions,
    enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return () => qc.invalidateQueries({ queryKey: feedIntegrityKeys.all });
}
export function useUpdateFeedIntegrityPolicy(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<FeedIntegrityPolicy>) =>
      updateFeedIntegrityPolicy(patch),
    onError: mutationError(locale),
    onSuccess: () => {
      invalidate(qc)();
      toast({
        title: copy(
          locale,
          'Feed Integrity settings saved',
          'حُفظت إعدادات سلامة الخلاصة'
        ),
        variant: 'success',
      });
    },
  });
}
export function useRunFeedIntegrity(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tier: FeedIntegrityTier) => runFeedIntegrity(tier),
    onSuccess: (run) => {
      invalidate(qc)();
      toast({
        title:
          run.status === 'partial'
            ? copy(
                locale,
                'Feed Integrity check finished with coverage gaps',
                'اكتمل فحص السلامة مع نقص في التغطية'
              )
            : run.status === 'failed'
              ? copy(
                  locale,
                  'Feed Integrity check failed',
                  'فشل فحص سلامة الخلاصة'
                )
              : copy(
                  locale,
                  'Feed Integrity run complete',
                  'اكتمل فحص سلامة الخلاصة'
                ),
        description: run.summary,
        variant:
          run.status === 'failed'
            ? 'destructive'
            : run.status === 'partial'
              ? 'default'
              : 'success',
      });
    },
    onError: (e: Error) =>
      toast({
        title: copy(
          locale,
          'Feed Integrity run failed',
          'فشل فحص سلامة الخلاصة'
        ),
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function usePauseFeedIntegritySchedule(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseFeedIntegritySchedule,
    onError: mutationError(locale),
    onSuccess: () => invalidate(qc)(),
  });
}
export function useCloseFeedIntegrityEpisode(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      notes,
    }: {
      id: string;
      reason: string;
      notes: string;
    }) => closeFeedIntegrityEpisode(id, reason, notes),
    onError: mutationError(locale),
    onSuccess: () => invalidate(qc)(),
  });
}
export function useRevokeFeedIntegritySuppression(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeFeedIntegritySuppression,
    onError: mutationError(locale),
    onSuccess: () => invalidate(qc)(),
  });
}
export function useUpdateFeedIntegrityAutopilotPolicy(
  locale: 'en' | 'ar' = 'en'
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<FeedIntegrityPolicy>) =>
      updateFeedIntegrityAutopilotPolicy(patch),
    onError: mutationError(locale),
    onSuccess: () => {
      invalidate(qc)();
      toast({
        title: copy(locale, 'Autopilot policy saved', 'حُفظت إعدادات الإصلاح'),
        variant: 'success',
      });
    },
  });
}
export function useRunFeedIntegrityAutopilot(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runFeedIntegrityAutopilot,
    onError: mutationError(locale),
    onSuccess: () => {
      invalidate(qc)();
      toast({
        title: copy(
          locale,
          'Latest integrity run evaluated',
          'تم تقييم أحدث فحص للسلامة'
        ),
        variant: 'success',
      });
    },
  });
}
export function usePauseFeedIntegrityAutopilot(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseFeedIntegrityAutopilot,
    onError: mutationError(locale),
    onSuccess: () => invalidate(qc)(),
  });
}
export function useApproveFeedIntegrityAction(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveFeedIntegrityAutopilotAction,
    onSuccess: () => {
      invalidate(qc)();
      toast({
        title: copy(locale, 'Action approved', 'تم اعتماد الإجراء'),
        variant: 'success',
      });
    },
    onError: (e: Error) =>
      toast({
        title: copy(locale, 'Approval blocked', 'تعذر اعتماد الإجراء'),
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function useRejectFeedIntegrityAction(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectFeedIntegrityAutopilotAction(id, reason),
    onError: mutationError(locale),
    onSuccess: () => invalidate(qc)(),
  });
}

function mutationError(locale: 'en' | 'ar' = 'en') {
  return (e: Error) => {
    toast({
      title: copy(
        locale,
        'Feed Integrity action failed',
        'فشل إجراء سلامة الخلاصة'
      ),
      description: e.message,
      variant: 'destructive',
    });
  };
}
export function useCreateFeedIntegritySuppression(locale: 'en' | 'ar' = 'en') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFeedIntegritySuppression,
    onSuccess: () => invalidate(qc)(),
    onError: mutationError(locale),
  });
}
export function useReviewFeedIntegrityUnknownAction(
  locale: 'en' | 'ar' = 'en'
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reviewFeedIntegrityUnknownAction,
    onSuccess: () => invalidate(qc)(),
    onError: mutationError(locale),
  });
}

function copy(locale: 'en' | 'ar', en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}
