import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import {
  listModerationReports,
  listCommentPolicyReviews,
  removeModerationComment,
  resolveCommentPolicyReview,
  resolveModerationReport,
} from '@/lib/api/cms/moderation';
import { updateIAMUserSuspension } from '@/lib/api/iam/admin-users';
import type { ModerationStatus } from '@/types/platform/moderation';

const moderationRootKey = ['moderation'] as const;

export const moderationKeys = {
  all: moderationRootKey,
  queue: (status: ModerationStatus | 'all', page = 1) =>
    [...moderationRootKey, 'queue', status, page] as const,
  policyReviews: [...moderationRootKey, 'policy-reviews'] as const,
};

export function useModerationQueue(status: ModerationStatus | 'all', page = 1) {
  return useQuery({
    queryKey: moderationKeys.queue(status, page),
    queryFn: () => listModerationReports(status, page),
    refetchInterval: 30_000,
  });
}

export function useCommentPolicyReviews() {
  return useQuery({
    queryKey: moderationKeys.policyReviews,
    queryFn: listCommentPolicyReviews,
    refetchInterval: 30_000,
  });
}

export function useResolveCommentPolicyReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'allow' | 'removed' }) =>
      resolveCommentPolicyReview(id, status),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: moderationKeys.all });
      toast({ title: 'Comment review resolved', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not resolve comment review',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useResolveModerationReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: 'resolved' | 'dismissed';
      reason?: string;
    }) => resolveModerationReport(id, status, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: moderationKeys.all });
      toast({ title: 'Report updated', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not update report',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useRemoveModerationComment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: removeModerationComment,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: moderationKeys.all });
      toast({ title: 'Comment removed', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not remove comment',
        description: error.message,
        variant: 'destructive',
      }),
  });
}

export function useSuspendModerationAuthor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      authorID,
      suspended,
    }: {
      authorID: string;
      suspended: boolean;
    }) => updateIAMUserSuspension(authorID, suspended),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: moderationKeys.all });
      toast({ title: 'Account suspension updated', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not update account suspension',
        description: error.message,
        variant: 'destructive',
      }),
  });
}
