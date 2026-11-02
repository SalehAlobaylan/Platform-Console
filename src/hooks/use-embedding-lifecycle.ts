import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import {
  abortCampaign,
  createCampaign,
  getEmbeddingStatus,
  getCampaign,
  getEmbeddingRun,
  listCampaigns,
  listEmbeddingRuns,
  pauseCampaign,
  previewCampaign,
  resumeCampaign,
  runEmbeddingAudit,
  startCampaign,
  retryEmbeddingException,
  waiveEmbeddingException,
  updateEmbeddingPolicy,
  type EmbeddingPolicy,
  type CampaignCaps,
} from '@/lib/api/cms/embedding-lifecycle';

export const embeddingKeys = {
  all: ['embedding-lifecycle'] as const,
  status: () => [...embeddingKeys.all, 'status'] as const,
  runs: () => [...embeddingKeys.all, 'runs'] as const,
  run: (id: number) => [...embeddingKeys.runs(), id] as const,
  campaigns: () => [...embeddingKeys.all, 'campaigns'] as const,
  campaign: (id: number) => [...embeddingKeys.campaigns(), id] as const,
};

export function useEmbeddingStatus() {
  return useQuery({
    queryKey: embeddingKeys.status(),
    queryFn: getEmbeddingStatus,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useEmbeddingCampaign(id: number, active = true) {
  // Switching to history requests a final snapshot even when the last active
  // response is still fresh in the query cache.
  return useQuery({
    queryKey: [...embeddingKeys.campaign(id), active ? 'active' : 'history'],
    queryFn: () => getCampaign(id),
    staleTime: 10_000,
    refetchInterval: active ? 10_000 : false,
  });
}
export function useEmbeddingRun(id?: number) {
  return useQuery({
    queryKey: embeddingKeys.run(id ?? 0),
    queryFn: () => getEmbeddingRun(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}
export function useEmbeddingRuns() {
  return useQuery({
    queryKey: embeddingKeys.runs(),
    queryFn: listEmbeddingRuns,
    staleTime: 15_000,
  });
}
export function useEmbeddingCampaigns() {
  return useQuery({
    queryKey: embeddingKeys.campaigns(),
    queryFn: listCampaigns,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return () => qc.invalidateQueries({ queryKey: embeddingKeys.all });
}

export function useRefreshEmbeddingLifecycle() {
  return invalidate(useQueryClient());
}

export function useUpdateEmbeddingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<EmbeddingPolicy>) =>
      updateEmbeddingPolicy(patch),
    onSuccess: () => {
      invalidate(qc)();
      toast({
        title: 'Embedding lifecycle settings saved',
        variant: 'success',
      });
    },
    onError: (e: Error) =>
      toast({
        title: 'Could not save settings',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function useRunEmbeddingAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runEmbeddingAudit,
    onSuccess: (run) => {
      invalidate(qc)();
      toast({
        title: 'Audit complete',
        description: run.headline,
        variant: run.status === 'failed' ? 'destructive' : 'success',
      });
    },
    onError: (e: Error) =>
      toast({
        title: 'Audit failed',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function usePreviewCampaign() {
  return useMutation({ mutationFn: (space: string) => previewCampaign(space) });
}
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ space, caps }: { space: string; caps: CampaignCaps }) =>
      createCampaign(space, caps),
    onSuccess: () => {
      invalidate(qc)();
      toast({ title: 'Campaign drafted', variant: 'success' });
    },
    onError: (e: Error) =>
      toast({
        title: 'Could not draft campaign',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function useStartCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      targetSpaceID,
    }: {
      id: number;
      reason: string;
      targetSpaceID: string;
    }) => startCampaign(id, reason, targetSpaceID),
    onSuccess: () => {
      invalidate(qc)();
      toast({ title: 'Campaign started', variant: 'success' });
    },
    onError: (e: Error) =>
      toast({
        title: 'Start blocked',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
export function useCampaignAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: number;
      action: 'pause' | 'resume' | 'abort';
    }) =>
      action === 'pause'
        ? pauseCampaign(id)
        : action === 'resume'
          ? resumeCampaign(id)
          : abortCampaign(id),
    onSuccess: () => invalidate(qc)(),
    onError: (e: Error) =>
      toast({
        title: 'Action failed',
        description: e.message,
        variant: 'destructive',
      }),
  });
}

export function useEmbeddingExceptionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      expiryHours = 168,
    }: {
      id: number;
      action: 'retry' | 'waive';
      reason?: string;
      expiryHours?: number;
    }) =>
      action === 'retry'
        ? retryEmbeddingException(id)
        : waiveEmbeddingException(id, reason ?? '', expiryHours),
    onSuccess: () => invalidate(qc)(),
    onError: (e: Error) =>
      toast({
        title: 'Exception action failed',
        description: e.message,
        variant: 'destructive',
      }),
  });
}
