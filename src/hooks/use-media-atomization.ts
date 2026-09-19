import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    atomizeMediaParent,
    getMediaAtomizationParentContext,
    approveAtomizedChapter,
    getMediaAtomizationPolicy,
    getMediaAtomizationOverview,
    getMediaAtomizationPipeline,
    listMediaAtomizationChapters,
    listMediaAtomizationFeedUnits,
    listMediaAtomizationParents,
    listMediaAtomizationRuns,
    listMediaAtomizationSources,
    reatomizeMediaParent,
    repairMediaAtomizationLeaks,
    rejectAtomizedChapter,
    runMediaAtomizationSweep,
    updateMediaAtomizationParentOverride,
    updateMediaAtomizationPolicy,
    updateMediaAtomizationSourcePolicy,
} from '@/lib/api/cms/media-atomization';
import type { AtomizationFilters, MediaAtomizationOverview, MediaAtomizationPolicyPatch } from '@/types/platform/media-atomization';
import { toast } from '@/components/ui/toast';

type QueryEnabledOption = { enabled?: boolean };

export const mediaAtomizationKeys = {
    all: ['media-atomization'] as const,
    overview: () => [...mediaAtomizationKeys.all, 'overview'] as const,
    policy: () => [...mediaAtomizationKeys.all, 'policy'] as const,
    sources: () => [...mediaAtomizationKeys.all, 'sources'] as const,
    pipeline: (filters: AtomizationFilters) => [...mediaAtomizationKeys.all, 'pipeline', filters] as const,
    parents: (filters: AtomizationFilters) => [...mediaAtomizationKeys.all, 'parents', filters] as const,
    feedUnits: (filters: Pick<AtomizationFilters, 'path' | 'source' | 'q'>) => [...mediaAtomizationKeys.all, 'feed-units', filters] as const,
    chapters: (filters: AtomizationFilters) => [...mediaAtomizationKeys.all, 'chapters', filters] as const,
    runs: () => [...mediaAtomizationKeys.all, 'runs'] as const,
    context: (id: string) => [...mediaAtomizationKeys.all, 'context', id] as const,
};

const activeStatuses = new Set([
    'queued',
    'waiting_media',
    'media_ready',
    'waiting_transcript',
    'transcript_ready',
    'planning',
    'cutting',
    'renditions',
    'children',
    'embedding',
    'embedding_pending',
]);

function overviewPollMs(data?: MediaAtomizationOverview): number {
    const hasActiveParents = data?.parent_status_counts?.some((row) => activeStatuses.has(row.name));
    const hasEmbeddingPending = data?.child_state_counts?.some((row) => row.feed_visibility === 'embedding_pending');
    return hasActiveParents || hasEmbeddingPending ? 5_000 : 60_000;
}

export function useMediaAtomizationPolicy(options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.policy(),
        queryFn: getMediaAtomizationPolicy,
        staleTime: 10_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationSources(options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.sources(),
        queryFn: () => listMediaAtomizationSources({ limit: 80 }),
        staleTime: 10_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationOverview(options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.overview(),
        queryFn: getMediaAtomizationOverview,
        enabled: options.enabled ?? true,
        refetchIntervalInBackground: false,
        refetchInterval: (query) => overviewPollMs(query.state.data),
        staleTime: 5_000,
    });
}

export function useMediaAtomizationParents(filters: AtomizationFilters, options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.parents(filters),
        queryFn: () => listMediaAtomizationParents({ ...filters, limit: 80 }),
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        staleTime: 5_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationParentContext(id?: string | null, options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.context(id ?? ''),
        queryFn: () => getMediaAtomizationParentContext(id!),
        staleTime: 10_000,
        enabled: Boolean(id) && (options.enabled ?? true),
    });
}

export function useMediaAtomizationFeedUnits(filters: Pick<AtomizationFilters, 'path' | 'source' | 'q'>, options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.feedUnits(filters),
        queryFn: () => listMediaAtomizationFeedUnits({ ...filters, limit: 200 }),
        refetchInterval: filters.path === 'blocked_transcript' || filters.path === 'invalid' ? 5_000 : 60_000,
        refetchIntervalInBackground: false,
        staleTime: 5_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationPipeline(filters: AtomizationFilters, options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.pipeline(filters),
        queryFn: () => getMediaAtomizationPipeline({ ...filters, limit: 320 }),
        refetchInterval: 5_000,
        refetchIntervalInBackground: false,
        staleTime: 5_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationChapters(filters: AtomizationFilters, options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.chapters(filters),
        queryFn: () => listMediaAtomizationChapters({ ...filters, limit: 80 }),
        refetchInterval: filters.review === 'needed' || filters.review === 'embedding_pending' ? 5_000 : 60_000,
        refetchIntervalInBackground: false,
        staleTime: 5_000,
        enabled: options.enabled ?? true,
    });
}

export function useMediaAtomizationRuns(options: QueryEnabledOption = {}) {
    return useQuery({
        queryKey: mediaAtomizationKeys.runs(),
        queryFn: () => listMediaAtomizationRuns({ limit: 30 }),
        refetchInterval: 5_000,
        staleTime: 5_000,
        enabled: options.enabled ?? true,
    });
}

export function useApproveAtomizedChapter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: approveAtomizedChapter,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            queryClient.invalidateQueries({ queryKey: ['media-journey'] });
            toast({ title: 'Chapter approved for publication', description: 'Publication waits for all remaining chapter and generation requirements.', variant: 'success' });
        },
        onError: (error: Error) => {
            toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
            queryClient.invalidateQueries({ queryKey: ['media-journey'] });
        },
    });
}

export function useRejectAtomizedChapter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: rejectAtomizedChapter,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Chapter rejected', variant: 'success' });
        },
        onError: (error: Error) => {
            toast({ title: 'Rejection failed', description: error.message, variant: 'destructive' });
        },
    });
}

export function useRepairMediaAtomizationLeaks() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: repairMediaAtomizationLeaks,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({
                title: 'Atomization invariants repaired',
                description: `${result.updated_count} item${result.updated_count === 1 ? '' : 's'} changed. ${result.remaining_count} visible duration issue${result.remaining_count === 1 ? '' : 's'} remaining.`,
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({ title: 'Repair failed', description: error.message, variant: 'destructive' });
        },
    });
}

export function useRunMediaAtomizationSweep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: runMediaAtomizationSweep,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({
                title: 'Atomization sweep queued',
                description: result.message ?? (result.jobId ? `Job ${result.jobId}` : 'Transcript-ready parents will be checked.'),
                variant: 'success',
            });
        },
        onError: (error: Error) => {
            toast({ title: 'Sweep failed', description: error.message, variant: 'destructive' });
        },
    });
}

export function useUpdateMediaAtomizationPolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateMediaAtomizationPolicy,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Atomization policy updated', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['media-journey'] });
        },
        onError: (error: Error) => toast({ title: 'Policy update failed', description: error.message, variant: 'destructive' }),
    });
}

export function useUpdateMediaAtomizationSourcePolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sourceId, patch }: { sourceId: string; patch: MediaAtomizationPolicyPatch }) =>
            updateMediaAtomizationSourcePolicy(sourceId, patch),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Source atomization policy updated', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['media-journey'] });
        },
        onError: (error: Error) => toast({ title: 'Source policy update failed', description: error.message, variant: 'destructive' }),
    });
}

export function useUpdateMediaAtomizationParentOverride() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ parentId, override, reason }: { parentId: string; override: 'inherit' | 'disabled' | 'enabled'; reason?: string }) =>
            updateMediaAtomizationParentOverride(parentId, override, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Episode atomization override updated', variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['media-journey'] });
        },
        onError: (error: Error) => toast({ title: 'Override update failed', description: error.message, variant: 'destructive' }),
    });
}

export function useAtomizeMediaParent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: atomizeMediaParent,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Atomization queued', description: result.message, variant: 'success' });
        },
        onError: (error: Error) => toast({ title: 'Atomization queue failed', description: error.message, variant: 'destructive' }),
    });
}

export function useReatomizeMediaParent() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: reatomizeMediaParent,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: mediaAtomizationKeys.all });
            toast({ title: 'Re-atomization queued', description: result.message, variant: 'success' });
        },
        onError: (error: Error) => toast({ title: 'Re-atomization queue failed', description: error.message, variant: 'destructive' }),
    });
}
